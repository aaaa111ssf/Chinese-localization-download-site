const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadJson(relativePath) {
  const fullPath = path.join(__dirname, '..', relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function verifyBlueprintDocument(document, label) {
  assert.equal(document.schemaVersion, 1, `${label}: schemaVersion must be 1`);
  assert.ok(Array.isArray(document.blueprints), `${label}: blueprints must be an array`);
  document.blueprints.forEach((blueprint, index) => {
    assert.equal(typeof blueprint.id, 'string', `${label}[${index}]: id is required`);
    assert.equal(typeof blueprint.name, 'string', `${label}[${index}]: name is required`);
    assert.equal(typeof blueprint.link, 'string', `${label}[${index}]: link is required`);
    assert.ok(Array.isArray(blueprint.requirements), `${label}[${index}]: requirements must be an array`);
    blueprint.requirements.forEach((requirement, requirementIndex) => {
      assert.equal(typeof requirement.name, 'string', `${label}[${index}].requirements[${requirementIndex}]: name is required`);
    });
  });
}

verifyBlueprintDocument(loadJson('data/blueprints.json'), 'blueprints.json');
verifyBlueprintDocument(loadJson('data/blueprints.template.json'), 'blueprints.template.json');
console.log('blueprint data verification passed');
