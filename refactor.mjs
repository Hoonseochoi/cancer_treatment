import fs from 'fs';
import path from 'path';

const configPath = './analyzer-next/lib/config.js';
let config = fs.readFileSync(configPath, 'utf8');
const mapIndex = config.indexOf('const coverageDetailsMap = {');
config = `export let currentFileName = "";\n\nexport ` + config.slice(mapIndex);
config = config.replace('function getCoverageIcon', 'export function getCoverageIcon');
fs.writeFileSync(configPath, config);

const analyzerPath = './analyzer-next/lib/analyzer.js';
let analyzer = fs.readFileSync(analyzerPath, 'utf8');
analyzer = `import { coverageDetailsMap } from './config.js';\n\n` + analyzer;
analyzer = analyzer.replace(/function parseKoAmount/g, 'export function parseKoAmount');
analyzer = analyzer.replace(/function formatKoAmount/g, 'export function formatKoAmount');
analyzer = analyzer.replace(/function formatDisplayAmount/g, 'export function formatDisplayAmount');
analyzer = analyzer.replace(/function calculateHierarchicalSummary/g, 'export function calculateHierarchicalSummary');
analyzer = analyzer.replace(/function findDetails/g, 'export function findDetails');
analyzer = analyzer.replace(/function extractRawCoverages/g, 'export function extractRawCoverages');
fs.writeFileSync(analyzerPath, analyzer);

const extractorPath = './analyzer-next/lib/pdf_extractor.js';
let extractor = fs.readFileSync(extractorPath, 'utf8');
extractor = extractor.replace('async function extractTextFromPDF(file, log = console.log) {', 'export async function extractTextFromPDF(file, pdfjsLib, Tesseract, updateProgress, showToast, log = console.log) {');
fs.writeFileSync(extractorPath, extractor);

console.log('Refactoring complete.');
