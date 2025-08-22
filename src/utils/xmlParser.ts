import * as xml2js from 'xml2js';

export interface UIElement {
  type: string;
  text: string;
  contentDesc: string;
  resourceId: string;
  className: string;
  package: string;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  center: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  clickable: boolean;
  enabled: boolean;
  focusable: boolean;
  scrollable: boolean;
  selected: boolean;
  checked: boolean;
}

export interface ProcessedUIData {
  texts: UIElement[];
  buttons: UIElement[];
  inputs: UIElement[];
  switches: UIElement[];
  clickables: UIElement[];
  scrollables: UIElement[];
  all: UIElement[];
}

function parseBounds(boundsStr: string): { left: number; top: number; right: number; bottom: number } {
  const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }
  
  return {
    left: parseInt(match[1]),
    top: parseInt(match[2]),
    right: parseInt(match[3]),
    bottom: parseInt(match[4])
  };
}

function calculateCenter(bounds: { left: number; top: number; right: number; bottom: number }): { x: number; y: number } {
  return {
    x: Math.round((bounds.left + bounds.right) / 2),
    y: Math.round((bounds.top + bounds.bottom) / 2)
  };
}

function calculateSize(bounds: { left: number; top: number; right: number; bottom: number }): { width: number; height: number } {
  return {
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top
  };
}

function processNode(node: any): UIElement | null {
  if (!node.$) return null;

  const attrs = node.$;
  const bounds = parseBounds(attrs.bounds || '[0,0][0,0]');
  const center = calculateCenter(bounds);
  const size = calculateSize(bounds);

  return {
    type: getElementType(attrs),
    text: attrs.text || '',
    contentDesc: attrs['content-desc'] || '',
    resourceId: attrs['resource-id'] || '',
    className: attrs.class || '',
    package: attrs.package || '',
    bounds,
    center,
    size,
    clickable: attrs.clickable === 'true',
    enabled: attrs.enabled === 'true',
    focusable: attrs.focusable === 'true',
    scrollable: attrs.scrollable === 'true',
    selected: attrs.selected === 'true',
    checked: attrs.checked === 'true'
  };
}

function getElementType(attrs: any): string {
  const className = attrs.class || '';
  const contentDesc = attrs['content-desc'] || '';
  const text = attrs.text || '';
  
  // Specific widget types
  if (className.includes('Switch') || className.includes('Toggle')) return 'switch';
  if (className.includes('EditText') || className.includes('Input')) return 'input';
  if (className.includes('Button')) return 'button';
  if (className.includes('CheckBox')) return 'checkbox';
  if (className.includes('RadioButton')) return 'radio';
  if (className.includes('SeekBar') || className.includes('Progress')) return 'progress';
  if (className.includes('Spinner')) return 'spinner';
  if (className.includes('ListView') || className.includes('RecyclerView')) return 'list';
  if (className.includes('ImageView')) return 'image';
  
  // Detect by behavior/attributes
  if (attrs.clickable === 'true') return 'button';
  if (text && text.trim()) return 'text';
  if (contentDesc && contentDesc.trim()) return 'text';
  
  return 'view';
}

function extractElements(node: any, elements: UIElement[] = []): UIElement[] {
  const element = processNode(node);
  if (element && isRelevantElement(element)) {
    elements.push(element);
  }

  if (node.node && Array.isArray(node.node)) {
    for (const childNode of node.node) {
      extractElements(childNode, elements);
    }
  } else if (node.node && typeof node.node === 'object') {
    extractElements(node.node, elements);
  }

  return elements;
}

function isRelevantElement(element: UIElement): boolean {
  // Include elements with text content
  if (element.text && element.text.trim()) return true;
  
  // Include elements with content description
  if (element.contentDesc && element.contentDesc.trim()) return true;
  
  // Include clickable elements
  if (element.clickable) return true;
  
  // Include scrollable elements
  if (element.scrollable) return true;
  
  // Include input elements (EditText)
  if (element.className.includes('EditText')) return true;
  
  // Include buttons
  if (element.className.includes('Button')) return true;
  
  // Include switches
  if (element.className.includes('Switch')) return true;
  
  // Include checkboxes
  if (element.className.includes('CheckBox')) return true;
  
  // Include elements with resource IDs (usually important)
  if (element.resourceId && element.resourceId.trim()) return true;
  
  return false;
}

export async function parseUIAutomatorXML(xmlContent: string): Promise<ProcessedUIData> {
  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: false
    });

    const result = await parser.parseStringPromise(xmlContent);
    const allElements = extractElements(result.hierarchy);

    const processedData: ProcessedUIData = {
      texts: allElements.filter(el => 
        (el.type === 'text' && (el.text.trim() || el.contentDesc.trim())) ||
        (el.contentDesc.trim() && !el.clickable)
      ),
      buttons: allElements.filter(el => 
        el.type === 'button' || 
        (el.clickable && el.className.includes('Button')) ||
        (el.clickable && el.contentDesc.includes('Entrar'))
      ),
      inputs: allElements.filter(el => 
        el.type === 'input' || 
        el.className.includes('EditText')
      ),
      switches: allElements.filter(el => 
        el.type === 'switch' || 
        el.className.includes('Switch')
      ),
      clickables: allElements.filter(el => el.clickable),
      scrollables: allElements.filter(el => el.scrollable),
      all: allElements
    };

    return processedData;
  } catch (error) {
    throw new Error(`Failed to parse UI XML: ${error}`);
  }
}

export function formatElementsForDisplay(data: ProcessedUIData): string {
  let output = '=== UI ELEMENTS ANALYSIS ===\n\n';

  if (data.texts.length > 0) {
    output += 'TEXTS:\n';
    data.texts.forEach((el, i) => {
      const displayText = el.text || el.contentDesc || 'Empty text';
      output += `  ${i + 1}. "${displayText}" at center (${el.center.x}, ${el.center.y}) [size ${el.size.width}x${el.size.height}]\n`;
      if (el.resourceId) output += `     ID: ${el.resourceId}\n`;
      if (el.contentDesc && el.contentDesc !== el.text) output += `     DESC: ${el.contentDesc}\n`;
    });
    output += '\n';
  }

  if (data.buttons.length > 0) {
    output += 'BUTTONS/CLICKABLES:\n';
    data.buttons.forEach((el, i) => {
      const label = el.contentDesc || el.text || 'Unlabeled button';
      output += `  ${i + 1}. "${label}" at center (${el.center.x}, ${el.center.y}) [size ${el.size.width}x${el.size.height}]\n`;
      if (el.resourceId) output += `     ID: ${el.resourceId}\n`;
      if (el.className) output += `     CLASS: ${el.className}\n`;
      if (!el.enabled) output += `     ⚠️  DISABLED\n`;
    });
    output += '\n';
  }

  if (data.inputs.length > 0) {
    output += 'INPUT FIELDS:\n';
    data.inputs.forEach((el, i) => {
      const currentValue = el.text || 'Empty';
      const placeholder = el.contentDesc || 'No description';
      output += `  ${i + 1}. Value: "${currentValue}" | Desc: "${placeholder}" at center (${el.center.x}, ${el.center.y}) [size ${el.size.width}x${el.size.height}]\n`;
      if (el.resourceId) output += `     ID: ${el.resourceId}\n`;
      if (!el.enabled) output += `     ⚠️  DISABLED\n`;
    });
    output += '\n';
  }

  if (data.switches.length > 0) {
    output += 'SWITCHES/TOGGLES:\n';
    data.switches.forEach((el, i) => {
      const label = el.contentDesc || el.text || 'Unlabeled switch';
      const state = el.checked ? 'ON' : 'OFF';
      output += `  ${i + 1}. "${label}" [${state}] at center (${el.center.x}, ${el.center.y}) [size ${el.size.width}x${el.size.height}]\n`;
      if (el.resourceId) output += `     ID: ${el.resourceId}\n`;
    });
    output += '\n';
  }

  if (data.scrollables.length > 0) {
    output += 'SCROLLABLE AREAS:\n';
    data.scrollables.forEach((el, i) => {
      const label = el.contentDesc || el.resourceId || 'Scrollable area';
      output += `  ${i + 1}. "${label}" at center (${el.center.x}, ${el.center.y}) [size ${el.size.width}x${el.size.height}]\n`;
    });
    output += '\n';
  }

  output += `SUMMARY: ${data.all.length} total elements (${data.texts.length} texts, ${data.buttons.length} buttons, ${data.inputs.length} inputs, ${data.switches.length} switches)\n`;

  return output;
}