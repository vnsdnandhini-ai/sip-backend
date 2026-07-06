# Spectroscopic Intelligence Platform (SIP)

A professional cloud-connected platform for pharmaceutical process monitoring, quality assurance, and compliance using HTML, CSS, and JavaScript.

---

## 📁 Project Structure

```
html practice/
├── frontend/                     # ✨ User Interface (HTML, CSS, JS)
│   ├── index.html               # Login page
│   ├── dashboard.html           # Dashboard with metrics
│   ├── projects.html            # Project management
│   ├── monitoring.html          # Monitoring point configuration
│   ├── parameters.html          # Process parameter setup
│   ├── checkout.html            # Checkout condition limits
│   ├── rules.html               # Regulatory rule management
│   ├── analytical.html          # Analytical data entry & upload
│   ├── compliance.html          # Compliance evaluation engine
│   ├── reports.html             # Report generation & export
│   ├── audit.html               # Audit trail viewer
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── dashboard.js
│   │   ├── project.js
│   │   ├── monitoring.js
│   │   ├── parameters.js
│   │   ├── checkout.js
│   │   ├── rules.js
│   │   ├── compliance.js
│   │   ├── reports.js
│   │   ├── audit.js
│   │   ├── nav.js
│   │   └── demo-data.js
│   ├── assets/
│   └── img/
│
├── backend/                      # 🔧 API Server (Node.js/Express)
│   ├── server.js
│   ├── package.json
│   ├── data.json
│   ├── Procfile
│   └── .elasticbeanstalk/
│
├── start-frontend.bat           # Windows: Start frontend
├── start-backend.bat            # Windows: Start backend
├── start-server.py              # Python HTTP server
└── README.md
```

---

## 🚀 Quick Start

### Frontend Only (Easiest)

**Windows:**
```batch
double-click start-frontend.bat
```

**Linux/Mac:**
```bash
python3 start-server.py
```

Then open: **http://localhost:8000**

**Login:**
- Username: `admin`
- Password: `admin123`

---

### With Backend (Optional)

**Windows:**
```batch
double-click start-backend.bat
```

**Linux/Mac:**
```bash
cd backend
npm install
npm start
```

Backend runs on: **http://localhost:3000**

---

## 📋 10 Modules

1. **Dashboard** - Metrics & KPIs
2. **Projects** - Manufacturing batches (CRUD)
3. **Monitoring Points** - Sampling locations
4. **Process Parameters** - Analytical parameters setup
5. **Checkout Conditions** - Acceptance/warning/critical limits
6. **Regulatory Rules** - FDA, GMP, ICH compliance
7. **Analytical Data** - Manual entry & CSV upload
8. **Compliance Engine** - Smart limit evaluation
9. **Reports** - Excel & PDF export
10. **Audit Trail** - Activity logging

---

## ✨ Features

- ✅ Professional white/light theme
- ✅ Fully configurable (no hardcoded values)
- ✅ Demo data with realistic pharmaceutical data
- ✅ Multi-page navigation
- ✅ localStorage persistence
- ✅ Session management
- ✅ CSV data upload with validation
- ✅ Intelligent compliance evaluation
- ✅ Report generation & export
- ✅ Complete audit trail

---

## 📊 Demo Data Included

**3 Projects:**
- Aspirin Batch A01
- Ibuprofen Batch B02
- Acetaminophen Batch C03

**5 Monitoring Points** across manufacturing lines

**6 Process Parameters** with spectroscopic instruments

**6 Regulatory Rules** pre-loaded

**6 Analytical Data Records** (all PASS status)

---

## 💾 Data Storage

- **Frontend Only**: Browser localStorage
- **With Backend**: backend/data.json

---

## 🎨 Design

- Professional white/light theme
- Responsive grid layout
- Accessible color contrast
- Smooth navigation
- Modal dialogs for forms

---

## 📱 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

---

## 🔐 Security

- Session-based auth
- Audit trail for all operations
- FDA 21 CFR Part 11 compliance
- Activity logging
- Session timeout

---

## 📦 Deploy

**Frontend:**
- Upload `frontend/` to any web host
- AWS S3 + CloudFront
- GitHub Pages

**Backend:**
- AWS Elastic Beanstalk (ready-to-deploy)
- Heroku
- Any Node.js host

---

## 📝 Key Notes

- All data is user-configurable
- No external dependencies (frontend)
- Vanilla HTML/CSS/JavaScript
- Express REST API (optional backend)
- Multi-user ready

---

**Access:** http://localhost:8000  
**Version:** 1.0  
**Last Updated:** July 2026
