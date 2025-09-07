#!/bin/bash
# Setup script for M365 RAG Agent MCP Server

echo "🚀 Setting up M365 RAG Agent MCP Server..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "📥 Installing requirements..."
pip install --upgrade pip
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and set your GOOGLE_API_KEY"
    echo "   Example: GOOGLE_API_KEY=your_actual_api_key_here"
    echo ""
fi

# Check if ChromaDB directory exists
CHROMA_DIR="../chroma_db_all_V2"
if [ ! -d "$CHROMA_DIR" ]; then
    echo "⚠️  WARNING: ChromaDB directory not found at $CHROMA_DIR"
    echo "   Please make sure the database exists and update config.yaml if needed."
fi

echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and set your GOOGLE_API_KEY"
echo "2. Verify ChromaDB path in config.yaml"
echo "3. Test the server: python demo_client.py"
echo "4. Run the server: python server.py"
