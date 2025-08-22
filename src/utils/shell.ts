import { execSync } from 'child_process';
import * as os from 'os';
import { sleep } from './sleep';


export async function executeCommand(command: string): Promise<string> {
  const platform = os.platform();
  let adjustedCommand = command;

  if (platform === 'win32') {
    // For Windows, handle specific commands that might differ
    if (command.includes('mkdir -p')) {
      adjustedCommand = command.replace(/mkdir -p/g, 'mkdir');
    }
  } else {
    // For Unix-like systems (Linux, macOS)
    if (command.includes('findstr')) {
      adjustedCommand = command.replace(/findstr/g, 'grep');
    }
  }

  await sleep(200);

  const result = execSync(adjustedCommand, { encoding: 'utf8' });
  
  await sleep(200);
  
  return result;
}

export async function createDirectory(dirPath: string): Promise<void> {
  const platform = os.platform();
  
  if (platform === 'win32') {
    execSync(`mkdir "${dirPath}"`, { encoding: 'utf8' });
  } else {
    execSync(`mkdir -p "${dirPath}"`, { encoding: 'utf8' });
  }
}

export function getBaseTestPath(): string {
  return process.cwd();
}