#!/bin/bash
echo "---------------------------------------------------"
echo "⚡ Installing ASTRANETRA dependencies..."
echo "---------------------------------------------------"
npm install

echo ""
echo "---------------------------------------------------"
echo "⚡ Registering 'astra' command globally..."
echo "---------------------------------------------------"
npm link

echo ""
echo "---------------------------------------------------"
echo "✅ Setup Complete!"
echo "You can now open ANY terminal and type: astra"
echo "---------------------------------------------------"
