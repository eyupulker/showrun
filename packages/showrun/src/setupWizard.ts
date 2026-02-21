/**
 * First-run setup wizard for ShowRun.
 * Interactively prompts for required and optional configuration values
 * when ANTHROPIC_API_KEY is not set anywhere in the config chain.
 */

import { createInterface } from 'readline';
import { updateGlobalConfig, getGlobalConfigDir, getGlobalDataDir } from '@showrun/core';

interface SetupField {
  envVar: string;
  label: string;
  required: boolean;
  defaultValue: string;
}

const SETUP_FIELDS: SetupField[] = [
  {
    envVar: 'ANTHROPIC_API_KEY',
    label: 'Anthropic API Key',
    required: true,
    defaultValue: '',
  },
  {
    envVar: 'ANTHROPIC_MODEL',
    label: 'Anthropic Model',
    required: true,
    defaultValue: 'claude-opus-4-5-20251101',
  },
  {
    envVar: 'ANTHROPIC_BASE_URL',
    label: 'Anthropic Base URL',
    required: true,
    defaultValue: 'https://api.anthropic.com',
  },
  {
    envVar: 'WEAVIATE_URL',
    label: 'Weaviate URL (for Techniques DB)',
    required: false,
    defaultValue: '',
  },
  {
    envVar: 'WEAVIATE_API_KEY',
    label: 'Weaviate API Key',
    required: false,
    defaultValue: '',
  },
  {
    envVar: 'EMBEDDING_MODEL',
    label: 'Embedding Model',
    required: false,
    defaultValue: 'text-embedding-3-small',
  },
];

function promptLine(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Check whether the setup wizard should run.
 * Returns true if ANTHROPIC_API_KEY is not set in env, .env, or config.json.
 * Call AFTER initConfig() and .env loading.
 */
export function needsSetup(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

/**
 * Run the interactive first-run setup wizard.
 * Prompts for configuration values and saves them to the global config.json.
 * Also sets the values in process.env for the current session.
 *
 * Returns true if setup completed successfully, false if user cancelled.
 */
export async function runSetupWizard(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // Handle Ctrl+C gracefully
  let cancelled = false;
  rl.on('close', () => {
    cancelled = true;
  });

  try {
    console.log('');
    console.log('=== ShowRun First-Run Setup ===');
    console.log('');
    console.log('No Anthropic API key found. Let\'s set up your configuration.');
    console.log(`Settings will be saved to: ${getGlobalConfigDir()}/config.json`);
    console.log(`Data will be stored in:    ${getGlobalDataDir()}/`);
    console.log('');
    console.log('Press Ctrl+C to cancel at any time.');
    console.log('');

    const values: Record<string, string> = {};

    for (const field of SETUP_FIELDS) {
      if (cancelled) return false;

      let hint: string;
      if (field.required && field.defaultValue) {
        hint = ` (default: ${field.defaultValue})`;
      } else if (field.required) {
        hint = ' [required]';
      } else if (field.defaultValue) {
        hint = ` (optional, default: ${field.defaultValue})`;
      } else {
        hint = ' (optional, press Enter to skip)';
      }

      const promptText = `  ${field.label}${hint}: `;

      let value = '';
      while (true) {
        if (cancelled) return false;
        value = await promptLine(rl, promptText);

        if (!value && field.defaultValue) {
          value = field.defaultValue;
          console.log(`    -> ${value}`);
        }

        if (field.required && !value) {
          console.log('    This field is required. Please enter a value.');
          continue;
        }

        break;
      }

      if (value) {
        values[field.envVar] = value;
        process.env[field.envVar] = value;
      }
    }

    if (cancelled) return false;

    console.log('');
    console.log('Saving configuration...');
    updateGlobalConfig(values);
    console.log(`Configuration saved to ${getGlobalConfigDir()}/config.json`);
    console.log('');
    console.log('You can update these settings later by editing the config file directly,');
    console.log('or by running: showrun config init --global');
    console.log('');

    return true;
  } finally {
    rl.close();
  }
}
