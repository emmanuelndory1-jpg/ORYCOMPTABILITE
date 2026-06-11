import fs from 'fs';
import path from 'path';

const componentsDir = path.join(process.cwd(), 'src/components');

function processFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // We look for: <div className="fixed inset-0 ...">
    // Followed by: <div className="... bg-white ... w-full max-w-... ">
    // Or similar patterns.
    
    // A simpler approach: find any div with className containing 'bg-white', 'w-full', 'max-w-'
    // that lacks 'max-h-' and 'overflow-y-auto'
    // BUT we only want it if it's the main container of a modal.
    // The easiest robust regex for modal containers:
    // class=".*w-full max-w-(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl).*bg-white.*rounded-.*"
    
    // Let's use string replacement to add max-h-[90vh] flex flex-col to such divs.
    const regex = /className="([^"]*bg-white[^"]*w-full max-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)[^"]*)"/g;
    
    content = content.replace(regex, (match, classNames) => {
        // If it already has max-h- or h-[
        if (classNames.includes('max-h-') || classNames.includes('h-[')) {
            return match;
        }
        
        // Add max-h-[90vh] flex flex-col
        changed = true;
        return `className="${classNames} max-h-[90vh] flex flex-col"`;
    });
    
    // We also need to ensure the inner content can scroll!
    // A typical modal has a header (p-.* flex flex-between ...), a body, and maybe a footer.
    // Without altering their exact dom, just adding flex flex-col to the wrapper and overflow-y-auto to the wrapper might be enough if we just overflow the whole modal!
    // Actually, adding "overflow-y-auto" to the main wrapper is SAFER, so the entire modal scrolls inside the max-h constraint.
    const regex2 = /className="([^"]*bg-white[^"]*w-full max-w-(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)[^"]*max-h-\[90vh\][^"]*)"/g;
    content = content.replace(regex2, (match, classNames) => {
        if (classNames.includes('overflow-y-auto') || classNames.includes('overflow-scroll')) return match;
        // If it doesn't have overflow-y-auto, let's just make the whole modal scrollable internally
        changed = true;
        return `className="${classNames} overflow-y-auto"`;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${path.basename(filePath)}`);
    }
}

const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
files.forEach(f => processFile(path.join(componentsDir, f)));
