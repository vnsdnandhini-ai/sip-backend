# 📂 SIP Project - File Manager Organization Guide

## Your Project Location
```
C:\Users\sri kanisha engineer\Desktop\html practice\
```

---

## 🎯 FRONTEND FILES
Complete UI application - Everything needed to run the platform

### Location: `frontend/`

#### HTML Pages (11 files)
```
frontend/
├── index.html                    ← Start here (Login page)
├── dashboard.html
├── projects.html
├── monitoring.html
├── parameters.html
├── checkout.html
├── rules.html
├── analytical.html
├── compliance.html
├── reports.html
└── audit.html
```

#### Styling
```
frontend/css/
└── style.css                     ← Professional white/light theme
```

#### JavaScript Modules (12 files)
```
frontend/js/
├── app.js                        ← Core logic & initialization
├── dashboard.js                  ← Dashboard metrics
├── project.js                    ← Projects CRUD
├── monitoring.js                 ← Monitoring points CRUD
├── parameters.js                 ← Parameters CRUD
├── checkout.js                   ← Checkout conditions CRUD
├── rules.js                      ← Regulatory rules CRUD
├── compliance.js                 ← Analytical data & compliance engine
├── reports.js                    ← Report generation & export
├── audit.js                      ← Audit trail display
├── nav.js                        ← Navigation helper
└── demo-data.js                  ← Pre-loaded demo data
```

#### Assets
```
frontend/assets/
├── icons/
└── images/

frontend/img/
```

**Total Frontend Files: 29 files**

---

## 🔧 BACKEND FILES
REST API server for cloud deployment

### Location: `backend/`

#### Server & Configuration
```
backend/
├── server.js                     ← Express REST API
├── package.json                  ← Node.js dependencies
├── data.json                     ← JSON database
└── Procfile                      ← AWS Elastic Beanstalk config
```

#### AWS Deployment
```
backend/.elasticbeanstalk/
└── config.yml                    ← EB environment configuration
```

**Total Backend Files: 5 files**

---

## 🚀 QUICK START SCRIPTS

### Windows Users (Click to run)
```
html practice/
├── start-frontend.bat            ← START FRONTEND (Port 8000)
└── start-backend.bat             ← START BACKEND (Port 3000)
```

### Linux/Mac Users
```bash
python3 start-server.py           # For frontend
cd backend && npm install && npm start  # For backend
```

### Python Server
```
html practice/
└── start-server.py               ← Custom HTTP server
```

---

## 📋 COMPLETE FILE LISTING

### Frontend (29 files)
```
HTML Files (11):
  - index.html
  - dashboard.html
  - projects.html
  - monitoring.html
  - parameters.html
  - checkout.html
  - rules.html
  - analytical.html
  - compliance.html
  - reports.html
  - audit.html

CSS Files (1):
  - css/style.css

JavaScript Files (12):
  - js/app.js
  - js/dashboard.js
  - js/project.js
  - js/monitoring.js
  - js/parameters.js
  - js/checkout.js
  - js/rules.js
  - js/compliance.js
  - js/reports.js
  - js/audit.js
  - js/nav.js
  - js/demo-data.js

Assets (5):
  - assets/icons/
  - assets/images/
  - img/
  + config files
```

### Backend (5 files)
```
  - server.js
  - package.json
  - data.json
  - Procfile
  - .elasticbeanstalk/config.yml
```

---

## 🎯 HOW TO USE

### Quick Start (Frontend Only)
1. Go to: `C:\Users\sri kanisha engineer\Desktop\html practice\`
2. Double-click: `start-frontend.bat`
3. Browser opens: `http://localhost:8000`
4. Login: `admin / admin123`

### With Backend API
1. Double-click: `start-backend.bat` (requires Node.js)
2. Double-click: `start-frontend.bat`
3. Access: `http://localhost:8000`

---

## 📊 10 MODULES IN FRONTEND

| Module | File | Purpose |
|--------|------|---------|
| **Login** | index.html | Authentication page |
| **Dashboard** | dashboard.html | KPIs & metrics |
| **Projects** | projects.html | Batch management |
| **Monitoring** | monitoring.html | Sample points |
| **Parameters** | parameters.html | Analytics setup |
| **Checkout** | checkout.html | Limit conditions |
| **Rules** | rules.html | Regulatory compliance |
| **Analytical** | analytical.html | Data entry & upload |
| **Compliance** | compliance.html | Evaluation engine |
| **Reports** | reports.html | Export & analytics |
| **Audit** | audit.html | Activity log |

---

## 💾 DATA STORAGE

**Frontend:** All data stored in browser's localStorage
- No database required
- Works offline
- Persists until browser cache cleared

**Backend:** Optional Node.js server
- Uses `backend/data.json` file
- Adds persistence & multi-user support
- Ready for cloud deployment

---

## 📝 DOCUMENTATION

```
C:\Users\sri kanisha engineer\Desktop\html practice\
├── README-ORGANIZED.md           ← Full documentation
└── README.md                      ← Project info
```

---

## ✅ VERIFICATION CHECKLIST

✓ Frontend folder: Contains all 11 HTML files
✓ CSS folder: Contains style.css
✓ JS folder: Contains 12 JavaScript modules
✓ Backend folder: Contains server.js, package.json, data.json
✓ Assets: Images and icons organized
✓ Start scripts: start-frontend.bat, start-backend.bat, start-server.py

---

## 🌐 ACCESS POINTS

| Component | URL | Notes |
|-----------|-----|-------|
| Frontend | http://localhost:8000 | Main UI |
| Backend | http://localhost:3000 | Optional REST API |
| Login | http://localhost:8000 | admin / admin123 |

---

## 📁 FILE MANAGER NAVIGATION

**To open File Manager:**
1. Press: `Win + E`
2. Navigate to: `Desktop → html practice`
3. You'll see two folders:
   - **frontend** (contains all UI files)
   - **backend** (contains server)

---

## 🎨 CUSTOMIZATION POINTS

- **Colors**: Edit `frontend/css/style.css`
- **Logic**: Edit modules in `frontend/js/`
- **Pages**: Edit HTML files in `frontend/`
- **API**: Modify `backend/server.js`
- **Data**: Update `backend/data.json`

---

## 📞 TROUBLESHOOTING

**Port 8000 already in use?**
- Change port in start-server.py (line 27)

**Backend not starting?**
- Install Node.js from nodejs.org
- Run: `npm install` in backend folder

**Data not persisting?**
- Check browser localStorage (F12)
- Ensure cookies enabled

---

**Last Updated:** July 2026  
**Total Files:** 34 organized files  
**Ready for:** Development, testing, deployment
