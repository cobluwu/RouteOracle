# RouteOracle 🌐🔮

**An autonomous supply chain rerouting agent powered by Google's Gemini.**

RouteOracle is an intelligent logistics and supply chain management platform designed to detect transit disruptions (weather, geopolitical events, port congestion) and autonomously execute or recommend optimal rerouting decisions *before* bottlenecks cascade into delivery failures.

By leveraging advanced ReAct loops and autonomous LLM orchestration, RouteOracle transforms static logistics monitoring into a proactive, self-healing supply chain network.

---

## ⚡ Core Capabilities

* **Predictive Disruption Detection:** Ingests live, multimodal data to identify emerging threats (e.g., sudden port strikes, severe weather fronts) before they impact active fleets.
* **Autonomous Rerouting (The Agent Loop):** Utilizes Gemini's advanced tool calling to calculate optimal alternative paths, factoring in fuel costs, time-to-delivery, and warehouse capacities.
* **Real-Time Telemetry Control:** Pushes live pathing updates via WebSockets directly to the active fleet.
* **Context Caching & Thought Signatures:** Maintains deep historical context of the supply chain network to ensure high-speed, cost-effective inference during critical rerouting decisions.

---

## 🏗️ System Architecture

RouteOracle is broken down into highly specialized modules, operating in tandem to provide a seamless agentic workflow:

| Module | Function |
| --- | --- |
| `Live_Telemetry` | Ingests real-time transit data and environmental variables via WebSockets. |
| `Agent_Terminal` | The core ReAct loop orchestrator powered by Gemini, handling reasoning, tool execution, and structured outputs. |
| `Geo_Network` | Manages spatial data, mapping interfaces, and route plotting. |
| `Active_Fleet` | Tracks real-time states, cargo loads, and fuel levels of all active transit vehicles. |
| `WMS_Nodes` | Interfaces with Warehouse Management Systems to gauge node capacity and offload feasibility. |
| `Sys_Config` | Manages global parameters, fallback behaviors, and API configurations. |

---

## 💻 Tech Stack

* **AI & LLM Orchestration:** Google AI Studio, Gemini 3.1 Pro API, Custom Python ReAct Agent
* **Backend & APIs:** Node.js / Express.js, Python, WebSockets for live telemetry
* **Frontend:** React 19, TypeScript, Tailwind CSS v4, Motion
* **Database & Auth:** Supabase (PostgreSQL)
* **Environment & Deployment:** Docker, WSL2 (Ubuntu 26.04 LTS), Google Cloud Platform

---

## 🚀 Getting Started

### Prerequisites

* Node.js (v20+) & Python (3.11+)
* Docker & Docker Compose
* Google AI Studio API Key (`GEMINI_API_KEY`)
* Supabase Project Keys

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/cobluwu/RouteOracle.git
cd RouteOracle

```


2. **Set up the AI Backend (Python)**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On WSL/Linux
pip install -r requirements.txt

```


3. **Set up the Client (React 19)**
```bash
cd ../client
npm install

```


4. **Environment Variables**
Create a `.env` file in the root directory and add your credentials:
```env
GEMINI_API_KEY=your_google_ai_studio_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

```


5. **Spin up the environment**
```bash
docker-compose up --build

```



---

*Designed and engineered for the Hack2Skill Google Solution Challenge.*
