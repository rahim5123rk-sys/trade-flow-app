import { execFileSync } from 'node:child_process';

const preferredDevices = [
  'iPhone 16 Pro Max',
  'iPhone 15 Pro Max',
  'iPhone 14 Pro Max',
  'iPhone 16 Plus',
  'iPhone 15 Plus',
];

function run(command, args) {
  return execFileSync(command, args, { encoding: 'utf8' }).trim();
}

function getAvailableDevices() {
  const json = run('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
  const parsed = JSON.parse(json);
  return Object.values(parsed.devices || {})
    .flat()
    .filter((device) => device.isAvailable)
    .map((device) => ({
      name: device.name,
      udid: device.udid,
      state: device.state,
      runtime: device.runtime || '',
    }));
}

function pickDevice(devices) {
  for (const name of preferredDevices) {
    const match = devices.find((device) => device.name === name);
    if (match) return match;
  }
  return devices.find((device) => device.name.startsWith('iPhone')) || null;
}

function main() {
  const devices = getAvailableDevices();
  const device = pickDevice(devices);

  if (!device) {
    throw new Error('No available iPhone simulators were found.');
  }

  console.log(`Using simulator: ${device.name}`);

  if (device.state !== 'Booted') {
    run('xcrun', ['simctl', 'boot', device.udid]);
  }

  run('open', ['-a', 'Simulator']);
  run('xcrun', ['simctl', 'bootstatus', device.udid, '-b']);

  console.log(`Simulator ready: ${device.name}`);
}

main();
