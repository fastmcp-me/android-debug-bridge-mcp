import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { executeCommand, createDirectory, getBaseTestPath } from '../utils/shell.js';
import { sleep } from '../utils/sleep.js';
import { parseUIAutomatorXML, formatElementsForDisplay } from '../utils/xmlParser.js';

const captureUIContent = async (includeRawXML: boolean = true) => {
  await executeCommand('adb shell uiautomator dump /sdcard/window_dump.xml');
  const xmlContent = await executeCommand('adb shell "cat /sdcard/window_dump.xml"');
  
  try {
    const processedUI = await parseUIAutomatorXML(xmlContent);
    const formattedOutput = formatElementsForDisplay(processedUI);
    
    const result = [
      {
        type: 'text',
        text: formattedOutput,
      },
    ];
    
    if (includeRawXML) {
      result.push({
        type: 'text',
        text: `\n=== RAW XML UI Automator ===\n${xmlContent}`,
      });
    }
    
    return result;
  } catch (error) {
    const result = [
      {
        type: 'text',
        text: `Error processing UI dump: ${error}`,
      },
      {
        type: 'text',
        text: `\n=== RAW XML DATA ===\n${xmlContent}`,
      }
    ];
  
    
    return result;
  }
};

export const toolHandlers = {
  create_test_folder: async (args: any) => {
    const { test_name } = args as { test_name: string };
    const testPath = path.join(getBaseTestPath(), test_name);
    
    await createDirectory(testPath);
    
    return {
      content: [
        {
          type: 'text',
          text: `Test folder created: ${testPath}`,
        },
      ],
    };
  },

  list_apps: async (args: any) => {
    const { app_name } = args as { app_name: string };    
    const result = await executeCommand(`adb shell pm list packages | findstr "${app_name}"`);
    
    return {
      content: [
        {
          type: 'text',
          text: result || 'No apps found matching the pattern',
        },
      ],
    };
  },

  open_app: async (args: any) => {
    const { package_name } = args as { 
      package_name: string; 
    };
    
    await executeCommand(`adb shell monkey -p ${package_name} 1`);
    await sleep(5000);
    
    return {
      content: [
        {
          type: 'text',
          text: `App opened: ${package_name}`,
        },
      ],
    };
  },

  capture_screenshot: async (args: any) => {
    const { test_name, step_name } = args as { 
      test_name: string; 
      step_name: string; 
    };
    
    const testPath = path.join(getBaseTestPath(), test_name);
    const screenshotPath = path.join(testPath, `${step_name}_step.png`);
    
    if (!fs.existsSync(testPath)) {
      fs.mkdirSync(testPath, { recursive: true });
    }
    
    await executeCommand(`adb exec-out screencap -p > "${screenshotPath}"`);
    
    // Read the screenshot file and convert to base64
    const imageData = fs.readFileSync(screenshotPath);
    const base64Image = imageData.toString('base64');
    
    return {
      content: [
        {
          type: 'text',
          text: `Screenshot captured: ${screenshotPath}`,
        },
        {
          type: 'image',
          data: base64Image,
          mimeType: 'image/png',
        },
      ],
    };
  },

  capture_ui_dump: async (args: any) => {
    const content = await captureUIContent(true);
    return {
      content: content,
    };
  },

  input_keyevent: async (args: any) => {
    const { key } = args as { key: string };
    
    const keyCodeMap = {
      BACK: '4',
      HOME: '3',
      ENTER: '66',
      DELETE: '67',
    };
    
    const keyCode = keyCodeMap[key as keyof typeof keyCodeMap];
    if (!keyCode) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid key: ${key}`);
    }
    
    await executeCommand(`adb shell input keyevent ${keyCode}`);
    
    const uiContent = await captureUIContent(false);
    
    return {
      content: [
        {
          type: 'text',
          text: `Key event sent: ${key} (${keyCode})`,
        },
        ...uiContent,
      ],
    };
  },

  input_tap: async (args: any) => {
    const { x, y } = args as { x: number; y: number };
    
    await executeCommand(`adb shell input tap ${x} ${y}`);
    
    const uiContent = await captureUIContent(false);
    
    return {
      content: [
        {
          type: 'text',
          text: `Tap executed at coordinates: (${x}, ${y})`,
        },
        ...uiContent,
      ],
    };
  },

  input_text: async (args: any) => {
    const { text } = args as { text: string };
    const escapedText = text.replace(/"/g, '\\"');
    
    await executeCommand(`adb shell input text "${escapedText}"`);

    await executeCommand(`adb shell input keyevent 66`);
    
    const uiContent = await captureUIContent(false);
    
    return {
      content: [
        {
          type: 'text',
          text: `Text input: ${text}`,
        },
        ...uiContent,
      ],
    };
  },

  input_scroll: async (args: any) => {
    const { direction } = args as { direction: string };
    
    const scrollCommands = {
      up: 'adb shell input swipe 500 800 500 400',
      down: 'adb shell input swipe 500 400 500 800',
      left: 'adb shell input swipe 800 500 400 500',
      right: 'adb shell input swipe 400 500 800 500',
    };
    
    const command = scrollCommands[direction as keyof typeof scrollCommands];
    if (!command) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid direction: ${direction}`);
    }
    
    await executeCommand(command);
    
    const uiContent = await captureUIContent(false);
    
    return {
      content: [
        {
          type: 'text',
          text: `Scroll executed: ${direction}`,
        },
        ...uiContent,
      ],
    };
  },
};