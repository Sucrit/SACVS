#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { faker } = require('@faker-js/faker');
const seedrandom = require('seedrandom');
const { v4: uuidv4 } = require('uuid');

function sha256Hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randDate(startYear = 2018, endYear = 2026) {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  const diff = end.getTime() - start.getTime();
  const randMs = Math.floor(Math.random() * diff);
  return new Date(start.getTime() + randMs);
}

function writeCsv(filename, rows, outDir) {
  if (!rows || rows.length === 0) return;
  fs.mkdirSync(outDir, { recursive: true });
  const filepath = path.join(outDir, filename);
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(',')];
  for (const r of rows) {
    const vals = keys.map(k => {
      const v = r[k] === null || r[k] === undefined ? '' : String(r[k]);
      if (v.includes(',') || v.includes('\n') || v.includes('"')) {
        return '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    });
    lines.push(vals.join(','));
  }
  fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${rows.length} rows to ${filepath}`);
}

function generateData({ nInstitutions = 10, nStudents = 200, nCredentials = 250, nRequests = 300, seed = null } = {}) {
  if (seed !== null) {
    seedrandom(String(seed), { global: true });
    faker.seed(Number(seed));
  }

  // Institutions
  const institutions = [];
  for (let i = 0; i < nInstitutions; i++) {
    institutions.push({
      institution_id: uuidv4(),
      name: faker.company.name() + ' University',
      type: ['University', 'College', 'Training Center'][Math.floor(Math.random() * 3)],
      country: faker.location.country(),
      accreditation_id: 'ACC-' + faker.string.numeric(4) + '-' + faker.string.alpha(4).toUpperCase()
    });
  }

  // Students
  const students = [];
  for (let i = 0; i < nStudents; i++) {
    const inst = institutions[Math.floor(Math.random() * institutions.length)];
    const dob = faker.date.birthdate({ min: 18, max: 45, mode: 'age' });
    students.push({
      student_id: uuidv4(),
      full_name: faker.person.fullName(),
      email: faker.internet.email(),
      gender: ['Male', 'Female', 'Other'][Math.floor(Math.random() * 3)],
      date_of_birth: dob.toISOString().split('T')[0],
      student_number: 'S-' + faker.string.numeric(7),
      institution_id: inst.institution_id
    });
  }

  // Credentials
  const credentialTypes = ['Diploma', 'Transcript', 'Certificate'];
  const programs = ['Computer Science', 'Information Systems', 'Data Science', 'Cybersecurity', 'Software Engineering', 'AI & ML'];
  const credentials = [];
  for (let i = 0; i < nCredentials; i++) {
    const stu = students[Math.floor(Math.random() * students.length)];
    const inst = institutions.find(x => x.institution_id === stu.institution_id);
    const issueDate = randDate(2020, 2026);
    const expires = (Math.random() < 0.8) ? null : new Date(issueDate.getTime() + 365 * 4 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const gpa = (Math.random() < 0.6) ? Math.round((2 + Math.random() * 2) * 100) / 100 : null;
    const record = `${stu.student_id}${inst.institution_id}${issueDate.toISOString()}${Math.random()}`;

    credentials.push({
      credential_id: uuidv4(),
      student_id: stu.student_id,
      institution_id: inst.institution_id,
      credential_type: credentialTypes[Math.floor(Math.random() * credentialTypes.length)],
      program_name: programs[Math.floor(Math.random() * programs.length)],
      issue_date: issueDate.toISOString().split('T')[0],
      expiry_date: expires,
      honors: (Math.random() < 0.2) ? ['Cum Laude', 'Magna Cum Laude', 'Summa Cum Laude'][Math.floor(Math.random() * 3)] : null,
      gpa: gpa,
      credential_hash: sha256Hash(record),
      blockchain_tx_hash: sha256Hash(uuidv4()).slice(0, 64),
      status: (Math.random() < 0.75) ? 'Issued' : 'Revoked'
    });
  }

  // AI Validation
  const aiValidations = [];
  for (const c of credentials) {
    const conf = Math.round((0.7 + Math.random() * 0.29) * 1000) / 1000;
    const fraud = Math.round((Math.random() * 0.3) * 1000) / 1000;
    let decision = (fraud < 0.2 && conf > 0.8) ? 'Approve' : 'Review';
    if (fraud > 0.25) decision = 'Reject';
    aiValidations.push({
      ai_validation_id: uuidv4(),
      credential_id: c.credential_id,
      model_version: ['v1.0', 'v1.1', 'v2.0'][Math.floor(Math.random() * 3)],
      confidence_score: conf,
      fraud_score: fraud,
      decision: decision,
      notes: faker.lorem.sentence(10)
    });
  }

  // Verification Requests
  const verificationRequests = [];
  for (let i = 0; i < nRequests; i++) {
    const c = credentials[Math.floor(Math.random() * credentials.length)];
    verificationRequests.push({
      request_id: uuidv4(),
      employer_name: faker.company.name(),
      employer_email: faker.internet.email(),
      credential_id: c.credential_id,
      request_date: randDate(2023, 2026).toISOString(),
      verification_result: ['Valid', 'Valid', 'Valid', 'Invalid', 'Pending'][Math.floor(Math.random() * 5)],
      response_time_ms: Math.floor(120 + Math.random() * (2500 - 120)),
      fraud_flag: (Math.random() < 0.08) ? 1 : 0
    });
  }

  return { institutions, students, credentials, aiValidations, verificationRequests };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { outputDir: './data', seed: null, nInstitutions: 10, nStudents: 200, nCredentials: 250, nRequests: 300 };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--output-dir' && args[i + 1]) { out.outputDir = args[i + 1]; i++; }
    else if (a === '--seed' && args[i + 1]) { out.seed = Number(args[i + 1]); i++; }
    else if (a === '--n-institutions' && args[i + 1]) { out.nInstitutions = Number(args[i + 1]); i++; }
    else if (a === '--n-students' && args[i + 1]) { out.nStudents = Number(args[i + 1]); i++; }
    else if (a === '--n-credentials' && args[i + 1]) { out.nCredentials = Number(args[i + 1]); i++; }
    else if (a === '--n-requests' && args[i + 1]) { out.nRequests = Number(args[i + 1]); i++; }
  }
  return out;
}

function main() {
  const opts = parseArgs();
  const { institutions, students, credentials, aiValidations, verificationRequests } = generateData({
    nInstitutions: opts.nInstitutions,
    nStudents: opts.nStudents,
    nCredentials: opts.nCredentials,
    nRequests: opts.nRequests,
    seed: opts.seed
  });

  writeCsv('institutions.csv', institutions, opts.outputDir);
  writeCsv('students.csv', students, opts.outputDir);
  writeCsv('credentials.csv', credentials, opts.outputDir);
  writeCsv('ai_validations.csv', aiValidations, opts.outputDir);
  writeCsv('verification_requests.csv', verificationRequests, opts.outputDir);
  console.log('Dataset generated.');
}

if (require.main === module) main();
