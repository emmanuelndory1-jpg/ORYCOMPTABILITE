const fs = require('fs');

const file = 'src/components/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const startIndex = content.indexOf('{isVisible(\'stats\') && (');
const bentoEnd = content.indexOf('{/* NEW: Audit & Activity Section */}');
const bentoContent = content.substring(startIndex, bentoEnd);

function findClosing(text, startChar, endChar, startIndex) {
  let depth = 1;
  let inString = false;
  let stringChar = null;
  let inTemplate = false;

  for (let i = startIndex + 1; i < text.length; i++) {
    const char = text[i];
    
    if (char === '\\') { i++; continue; }
    
    if (!inString && !inTemplate) {
      if (char === '"' || char === "'") { inString = true; stringChar = char; }
      else if (char === '`') { inTemplate = true; }
      else if (char === startChar) { depth++; }
      else if (char === endChar) {
        depth--;
        if (depth === 0) return i;
      }
    } else if (inString) {
      if (char === stringChar) { inString = false; }
    } else if (inTemplate) {
      if (char === '`') { inTemplate = false; }
    }
  }
  return -1;
}

let currentIndex = 0;
const extractedWidgets = [];

while (true) {
  const matchIdx = bentoContent.indexOf('{isVisible(', currentIndex);
  if (matchIdx === -1) break;

  const quoteStart = matchIdx + 12; // after {isVisible('
  const quoteEnd = bentoContent.indexOf("'", quoteStart);
  const id = bentoContent.substring(quoteStart, quoteEnd);

  const andIdx = bentoContent.indexOf('&& (', quoteEnd);
  const startParenIdx = andIdx + 3;
  
  const endParenIdx = findClosing(bentoContent, '(', ')', startParenIdx);
  if (endParenIdx === -1) {
    break;
  }
  
  const blockStart = matchIdx;
  const blockEnd = endParenIdx + 2; 
  const contentBody = bentoContent.substring(startParenIdx + 1, endParenIdx);

  extractedWidgets.push({ id, source: bentoContent.substring(blockStart, blockEnd), content: contentBody });

  currentIndex = blockEnd;
}

console.log('Found:', extractedWidgets.map(w => w.id));

let newBentoContent = `
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => {
            const { active, over } = e;
            if (over && active.id !== over.id) {
              setWidgets((widgets) => {
                const oldIndex = widgets.findIndex((w) => w.id === active.id);
                const newIndex = widgets.findIndex((w) => w.id === over.id);
                const updated = arrayMove(widgets, oldIndex, newIndex);
                localStorage.setItem('dashboard_widgets', JSON.stringify(updated));
                return updated;
              });
            }
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 2xl:gap-8 min-h-[400px]">
             <SortableContext 
              items={widgets.filter(w => [${extractedWidgets.map(w => "'" + w.id + "'").join(',')}].includes(w.id) && w.visible).map(w => w.id)} 
              strategy={rectSortingStrategy}
             >
              {widgets.filter(w => [${extractedWidgets.map(w => "'" + w.id + "'").join(',')}].includes(w.id) && w.visible).map((widget) => {
                 switch (widget.id) {
                    ${extractedWidgets.map(w => `
                    case '${w.id}': 
                      return (
                        <SortableWidget key={widget.id} id={widget.id} className="${
                          w.id === 'stats' ? 'col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 2xl:gap-8' :
                          w.id === 'quick_stats' ? 'lg:col-span-4' :
                          w.id === 'health' ? 'lg:col-span-2 lg:row-span-2' :
                          w.id === 'performance' ? 'lg:col-span-2' :
                          w.id === 'cashflow' ? 'lg:col-span-4' :
                          w.id === 'financial_health' ? 'lg:col-span-4 border-0 shadow-none bg-transparent' :
                          w.id === 'performance_ratios' ? 'lg:col-span-4 border-0 shadow-none bg-transparent' :
                          w.id === 'expenses' ? 'lg:col-span-4' :
                          w.id === 'asset_summary' ? 'lg:col-span-4 grid bg-transparent border-0' :
                          'col-span-1'
                        }">
                           ${w.content.trim()}
                        </SortableWidget>
                      );
                    `).join('\n')}
                    default: return null;
                 }
              })}
             </SortableContext>
          </div>
        </DndContext>
`;

let fullNewContent = content.substring(0, content.indexOf('      {/* Bento Grid Layout */}')) + `
      {/* Bento Grid Layout - Sortable */}
      <div 
        style={{ order: getGroupOrder([
          'stats', 'quick_stats', 'health', 'tax_calendar', 'compliance', 
          'runway', 'advisor', 'shortcut', 'payroll_summary', 'performance', 
          'cashflow', 'financial_health', 'performance_ratios', 'expenses', 
          'asset_summary'
        ]) }}
      >
        ${newBentoContent}
      </div>
` + content.substring(bentoEnd);

fs.writeFileSync('src/components/Dashboard-refactor.tsx', fullNewContent);
console.log('Success.');
