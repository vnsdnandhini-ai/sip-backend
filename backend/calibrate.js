/**
 * calibrate.js
 *
 * Runs analyzeImage() against a batch of known-normal and known-damaged
 * grain kernel images (from GrainSet, expert-labeled), then reports the
 * contamination% distribution for each group so we can pick a real,
 * data-driven threshold instead of guessing.
 *
 * Usage: node calibrate.js
 */

const fs = require('fs');
const path = require('path');
const { analyzeImage } = require('./imageAnalysis');

async function analyzeFolder(folderPath) {
  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith('.png') || f.endsWith('.jpg'));
  const results = [];

  for (const file of files) {
    const buffer = fs.readFileSync(path.join(folderPath, file));
    try {
                  const analysis = await analyzeImage(buffer);
      results.push({
        file,
        contaminationPercent: analysis.contaminationPercent,
        textureEntropy: analysis.textureEntropy,
        maxPatchContaminationPercent: analysis.maxPatchContaminationPercent,
      });
    } catch (err) {
      console.error(`Failed to analyze ${file}:`, err.message);
    }
  }

  return results;
}

function stats(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n,
    mean: +mean.toFixed(2),
    stddev: +stddev.toFixed(2),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

(async () => {
      console.log('Analyzing normal samples...');
  const normalResults = await analyzeFolder(path.join(__dirname, 'calibration-samples', 'normal'));
  normalResults.forEach((r) => console.log(`  ${r.file}: maxPatch=${r.maxPatchContaminationPercent}%`));

  console.log('\nAnalyzing damaged samples...');
  const damagedResults = await analyzeFolder(path.join(__dirname, 'calibration-samples', 'damaged'));
  damagedResults.forEach((r) => console.log(`  ${r.file}: maxPatch=${r.maxPatchContaminationPercent}%`));

  function report(label, normalVals, damagedVals) {
    const normalStats = stats(normalVals);
    const damagedStats = stats(damagedVals);
    console.log(`\n=== ${label} ===`);
    console.log('Normal:', normalStats);
    console.log('Damaged:', damagedStats);
    const separationExists = normalStats.max < damagedStats.min;
    console.log('Clean separation?', separationExists);
    if (separationExists) {
      console.log(`Suggested threshold (midpoint): ${+((normalStats.max + damagedStats.min) / 2).toFixed(2)}`);
    }
  }

    report('MAX PATCH CONTAMINATION %', normalResults.map((r) => r.maxPatchContaminationPercent), damagedResults.map((r) => r.maxPatchContaminationPercent));
})();