#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  
  const frontmatterText = match[1];
  const body = match[2];
  const frontmatter = {};
  
  frontmatterText.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      frontmatter[key.trim()] = valueParts.join(':').trim().replace(/^['"]|['"]$/g, '');
    }
  });
  
  return { frontmatter, body };
}

function extractTeamSection(body) {
  const match = body.match(/^# Team\s*$/m);
  return match ? match.index : null;
}

function findNextSection(body, startPos) {
  const match = body.slice(startPos + 6).match(/\n# /);
  return match ? startPos + 6 + match.index : body.length;
}

async function generateTeam(pokePasteUrl) {
  try {
    const output = execSync(`node ${path.join(__dirname, '../team-generator.js')} "${pokePasteUrl}"`, {
      encoding: 'utf-8',
      timeout: 30000
    });
    return output;
  } catch (error) {
    console.error(`Error generating team from ${pokePasteUrl}:`, error.message);
    return null;
  }
}

async function updateRecapFile(filepath) {
  try {
    let content = fs.readFileSync(filepath, 'utf-8');
    const { frontmatter, body } = extractFrontmatter(content);
    
    // Only process if type is "recap"
    if (frontmatter.type !== 'recap') {
      return false;
    }
    
    // Check if there's a pokepaste link
    const pokePasteUrl = frontmatter.team;
    if (!pokePasteUrl) {
      return false;
    }
    
    console.log(`Processing ${filepath}...`);
    
    // Generate team HTML
    const teamHtml = await generateTeam(pokePasteUrl);
    if (!teamHtml) {
      return false;
    }
    
    // Find Team section
    const teamPos = extractTeamSection(body);
    if (teamPos === null) {
      console.log(`  No '# Team' section found in ${filepath}`);
      return false;
    }
    
    // Find next section or end of file
    const nextSectionPos = findNextSection(body, teamPos);
    
    // Replace team content
    const beforeTeam = body.slice(0, teamPos + 7); // "# Team\n"
    const afterTeam = body.slice(nextSectionPos);
    
    const newBody = beforeTeam + '\n' + teamHtml.trim() + '\n\n' + afterTeam;
    
    // Reconstruct file with frontmatter
    const frontmatterStr = Object.entries(frontmatter)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    const newContent = `---\n${frontmatterStr}\n---\n${newBody}`;
    
    fs.writeFileSync(filepath, newContent, 'utf-8');
    console.log(`  ✓ Updated ${filepath}`);
    return true;
  } catch (error) {
    console.error(`Error updating ${filepath}:`, error.message);
    return false;
  }
}

async function main() {
  const docsDir = path.join(__dirname, '../docs');
  
  if (!fs.existsSync(docsDir)) {
    console.log('docs/ directory not found');
    return;
  }
  
  const mdFiles = [];
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (file.endsWith('.md')) {
        mdFiles.push(fullPath);
      }
    });
  }
  
  walkDir(docsDir);
  
  let updated = 0;
  for (const mdFile of mdFiles) {
    if (await updateRecapFile(mdFile)) {
      updated++;
    }
  }
  
  console.log(`\nUpdated ${updated} file(s)`);
}

main().catch(console.error);
