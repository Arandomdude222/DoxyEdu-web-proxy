<p align="center">
  <img src="https://doxyedu.dpdns.org/LOGO.svg" alt="DoxyEdu Logo" width="400">
</p>

# DoxyEdu Web Proxy

**A Web Proxy designed to unblock websites, powered by the Scramjet engine**

> ⚠️ **Important:** This is a heavily-modified version of [Scramjet](https://github.com/MercuryWorkshop/scramjet), not original work.

## 📋 About This Fork

This repository contains modifications to the original Scramjet project and customized for unblocking websites in places like school:

## 🔧 Modifications from Original

- **Complete UI rebranding** for DoxyEdu
- **Pre-configured Python Wisp backend** (production-ready)
- **Optimized for educational environments**
- **Multi-tab support** - access multiple webpages simultaneously
- **Enhanced features** beyond the original

## 🚀 Quick Setup

### Frontend (Node.js):
```bash
git clone https://github.com/Arandomdude22/DoxyEdu-web-proxy.git
cd DoxyEdu-web-proxy
pnpm install
```
Backend (Python Wisp Server):
```
# Install Python if not already installed
sudo apt install python3 python3-pip python-is-python3

# Install Wisp server
pip install wisp-python
```
AND now start it:
```pnpm start```

📄 License & Attribution
Original work: Scramjet by Mercury Workshop (GNU AGPL)

Modified by ME

Note: For the original, maintained version, visit the official Scramjet repository.

## ❓ FAQ

**How can I deploy this?**

There are a few ways to deploy this application:

1.  **Using Docker (Recommended):** The repository includes a `Dockerfile` and `docker-compose.yml` for easy containerized deployment.
2.  **Manual Setup:** You can follow the "Quick Setup" instructions in this README to run the Node.js frontend and Python backend manually.
3.  **On Replit:** The project is configured to run on the Replit platform.

**Where is the backend python part?**

The Python backend is not included in this repository's source code. It is a separate package called `wisp-python` that you need to install via `pip`. The frontend is then configured to communicate with this backend service.


