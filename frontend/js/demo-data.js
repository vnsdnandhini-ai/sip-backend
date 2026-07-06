// Demo data initializer for Spectroscopic Intelligence Platform
(function() {
  const generateId = () => `id-${Math.random().toString(36).slice(2,10)}-${Date.now()}`;
  
  const demoState = {
    session: { user: "admin", token: "demo", loggedAt: new Date().toISOString() },
    projects: [
      { id: generateId(), name: "Aspirin Batch A01", product: "Aspirin 500mg", batchNumber: "ASP-2024-001", department: "Production", line: "Line 1", status: "Active" },
      { id: generateId(), name: "Ibuprofen Batch B02", product: "Ibuprofen 200mg", batchNumber: "IBU-2024-002", department: "Production", line: "Line 2", status: "Active" },
      { id: generateId(), name: "Acetaminophen Batch C03", product: "Acetaminophen 325mg", batchNumber: "ACE-2024-003", department: "QA", line: "Line 3", status: "Completed" }
    ],
    monitoringPoints: [
      { id: generateId(), name: "Raw Material Inspection", location: "Warehouse A", frequency: "30 min", description: "Initial material quality check", status: "Active" },
      { id: generateId(), name: "Granulation Process", location: "Line 1", frequency: "15 min", description: "Particle size and distribution", status: "Active" },
      { id: generateId(), name: "Drying Chamber", location: "Line 2", frequency: "10 min", description: "Temperature and humidity control", status: "Active" },
      { id: generateId(), name: "Blending Stage", location: "Line 3", frequency: "20 min", description: "Blend uniformity verification", status: "Active" },
      { id: generateId(), name: "Compression", location: "Line 1", frequency: "5 min", description: "Tablet hardness and weight", status: "Active" }
    ],
    parameters: [
      { id: generateId(), name: "Raman Spectral Similarity", instrument: "Raman Spectrometer", unit: "%", frequency: "30 sec", description: "Spectroscopic similarity score" },
      { id: generateId(), name: "NIR Absorbance", instrument: "NIR Analyzer", unit: "AU", frequency: "60 sec", description: "Near-infrared absorption" },
      { id: generateId(), name: "FTIR Peak Intensity", instrument: "FTIR Spectrometer", unit: "Intensity", frequency: "60 sec", description: "Peak height measurement" },
      { id: generateId(), name: "Moisture Content", instrument: "Karl Fischer Titrator", unit: "%", frequency: "120 sec", description: "Water content" },
      { id: generateId(), name: "Particle Size", instrument: "Laser Diffraction", unit: "µm", frequency: "300 sec", description: "Mean diameter" },
      { id: generateId(), name: "pH", instrument: "pH Meter", unit: "pH", frequency: "180 sec", description: "Acidity measurement" }
    ],
    checkoutConditions: [
      { id: generateId(), parameter: "Raman Spectral Similarity", acceptance: "85-100%", warning: "70-84%", critical: "<70%", action: "Reject batch" },
      { id: generateId(), parameter: "NIR Absorbance", acceptance: "0.8-1.2", warning: "0.6-0.79", critical: "<0.6", action: "Recalibrate" },
      { id: generateId(), parameter: "Moisture Content", acceptance: "2-4%", warning: "4-5%", critical: ">5%", action: "Review" },
      { id: generateId(), parameter: "Particle Size", acceptance: "50-150", warning: "30-49", critical: "<30", action: "Adjust" },
      { id: generateId(), parameter: "pH", acceptance: "6.5-7.5", warning: "6-6.4", critical: "<6", action: "Add buffer" }
    ],
    regulatoryRules: [
      { id: generateId(), name: "FDA 21 CFR Part 11", description: "Electronic records compliance", status: "Active" },
      { id: generateId(), name: "GMP", description: "Good Manufacturing Practices", status: "Active" },
      { id: generateId(), name: "ICH Q8", description: "Pharmaceutical development", status: "Active" },
      { id: generateId(), name: "ICH Q9", description: "Quality risk management", status: "Active" },
      { id: generateId(), name: "ICH Q10", description: "Quality system guidance", status: "Active" },
      { id: generateId(), name: "SOP", description: "Standard operating procedures", status: "Active" }
    ],
    analyticalData: [
      { id: generateId(), parameter: "Raman Spectral Similarity", instrument: "Raman Spectrometer", value: "92.5", unit: "%", timestamp: new Date(Date.now() - 3600000).toISOString(), result: "PASS" },
      { id: generateId(), parameter: "NIR Absorbance", instrument: "NIR Analyzer", value: "0.95", unit: "AU", timestamp: new Date(Date.now() - 3000000).toISOString(), result: "PASS" },
      { id: generateId(), parameter: "Moisture Content", instrument: "Karl Fischer", value: "3.2", unit: "%", timestamp: new Date(Date.now() - 2400000).toISOString(), result: "PASS" },
      { id: generateId(), parameter: "Particle Size", instrument: "Laser Diffraction", value: "95.5", unit: "µm", timestamp: new Date(Date.now() - 1800000).toISOString(), result: "PASS" },
      { id: generateId(), parameter: "pH", instrument: "pH Meter", value: "7.1", unit: "pH", timestamp: new Date(Date.now() - 1200000).toISOString(), result: "PASS" },
      { id: generateId(), parameter: "FTIR Peak Intensity", instrument: "FTIR", value: "450", unit: "Intensity", timestamp: new Date(Date.now() - 600000).toISOString(), result: "PASS" }
    ],
    complianceResults: [],
    auditTrail: [],
    reports: []
  };
  
  localStorage.setItem('sipState', JSON.stringify(demoState));
  console.log('Demo data initialized!');
})();
