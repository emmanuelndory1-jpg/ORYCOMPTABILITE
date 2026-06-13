const fs = require('fs');

let path = 'src/components/TasksManager.tsx';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
  /return \{ id: , originalId: dl\.id/,
  "return { id: \"dl-\" + dl.id + \"-\" + i, originalId: dl.id"
);

// also fix settingsRes definition
code = code.replace(
  /if \(advRes\.ok\) setAdvances\(await advRes\.json\(\)\);\s*if/,
  "if (advRes.ok) setAdvances(await advRes.json());\n      if"
)

fs.writeFileSync(path, code);
