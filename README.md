# Pareidolia // Data Viz

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

**Pareidolia** is a robust, flexible time-series data visualizer and manipulator. It is designed to ingest "dirty" CSVs, intelligently merge multiple datasets, and produce beautiful, publication-ready interactive charts with a retro-modern "Cafe Racer" aesthetic.

## ✨ Key Features

### 🛠 Robust Data Ingestion
- **Smart Detection**: Automatically detects delimiters (`,`, `;`, `\t`) and decimal separators (`.` vs `,`).
- **Flexible Parsing**: Handles European (`DD/MM/YYYY`) and ISO (`YYYY-MM-DD`) datetime formats seamlessly.
- **Cleaning**: Easily exclude specific rows (e.g., "2, 3-5") or columns by index.
- **Unit Handling**: Auto-detects and skips metadata/unit rows often found in scientific exports.

### 🔗 Advanced Data Wrangling
- **Multi-File Merging**: Upload multiple CSVs at once.
- **Intelligent Combination**:
  - **Merge by Name**: Rename columns to the same alias across different files to combine them into a single continuous series (Last-Write-Wins logic).
  - **Prefix Mode**: Option to automatically prefix columns with filenames to keep datasets distinct.
- **Aggregation**: built-in time resampling (15min, Hourly, Daily, Weekly, etc.) using Sum, Mean, Min, Max, or Abs Sum.

### 📈 Visualization
- **Interactive Charts**: built on Recharts with custom "Glow" effects and smooth interactions.
- **Multi-Axis Support**: Create unlimited custom Y-axes (Left/Right) with independent scaling.
- **Chart Types**: Line, Area, Bar, and Scatter plots supported per-series.
- **Aesthetics**: Custom "Cafe Racer" color palettes and a cream/charcoal/rust design system.

### 🧠 AI Integration
- **Google Gemini Powered**: Integrated neural analysis to scan datasets for trends, anomalies, and quality issues.
- **Natural Language Insights**: Get a text summary of your data's behavior without writing code.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- A Google Gemini API Key (Optional, for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pareidolia.git
   cd pareidolia
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Key (Optional)**
   Create a `.env` file in the root directory:
   ```env
   API_KEY=your_google_gemini_api_key
   ```

4. **Run the application**
   ```bash
   npm start
   ```

## 🎮 Usage Guide

1. **Data Source Tab**:
   - Drop your CSV files.
   - Use the **File Configuration** cards to tweak parsing (skip rows, delimiters).
   - Use the **Column Mapping** section to rename columns. *Tip: Rename columns from different files to the same name to merge them.*
   - Check the **Data Preview** at the bottom to verify structure.

2. **Visualize Tab**:
   - Select your **X-Axis** (usually a datetime column).
   - Click **(+)** to add data series.
   - Assign series to **Left/Right** axes or create **New Axes** dynamically.
   - Use the **Settings** icon next to an axis to fix Min/Max ranges or rename the axis.
   - Click the **Sparkles** icon (bottom right) to generate AI insights.

## 🎨 Aesthetics

Pareidolia uses a custom design system:
- **Background**: `#F2F0E9` (Cream) with SVG Noise Texture.
- **Foreground**: `#2A2A2A` (Charcoal).
- **Accents**: `#D94F2B` (Rust/Orange).

## 📄 License

This project is licensed under the MIT License.
