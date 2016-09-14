import { EventEmitter } from 'events';
import net from 'net';
import util from 'util';

// Platform Shim for HTTP audio zone
//
// Remember to add platform to config.json. Example:
// 'platforms': [
//     {
//         'platform': 'AudioZone',           // required
//         'name': 'AudioZone',                 // required
//     }
// ],
//
// When you attempt to add a device, it will ask for a 'PIN code'.
// The default code for all HomeBridge accessories is 031-45-154.
//

const priv = Symbol();
let Service;
let Characteristic;
let VolumeCharacteristic;

//
// Custom Characteristic for Volume
//
function makeVolumeCharacteristic() {
  VolumeCharacteristic = () => {
    Characteristic.call(this, 'Volume', '91288267-5678-49B2-8D22-F57BE995AA93');
    this.setProps({
      format: Characteristic.Formats.INT,
      unit: Characteristic.Units.PERCENTAGE,
      maxValue: 100,
      minValue: 0,
      minStep: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };

  util.inherits(VolumeCharacteristic, Characteristic);
}

class AudioZoneItem {
  constructor(log, item, platform) {
    // device info
    this.name = item.name;
    this.model = 'AudioZone';
    this.zoneId = item.id;
    this.serial = item.serial;
    this.log = log;
    this.platform = platform;
  }

  get(type, callback) {
    switch (type) {
      case 'power':
        this.platform.getPower(this.zoneId, (level) => {
          callback(null, level ? 1 : 0);
        });
        break;
      case 'volume':
        this.platform.getVolume(this.zoneId, (level) => {
          callback(null, level);
        });
        break;
      default:
        console.log('UNKNOWN', type);
        callback();
        break;
    }
  }

  setPower(state, callback) {
    this.platform.setPower(this.zoneId, state, () => {
      callback();
    });
  }

  setVolume(value, callback) {
    this.platform.setVolume(this.zoneId, value, () => {
      callback();
    });
  }

  getServices() {
    const services = [];
    this.service = new Service.Switch(this.name);

    // gets and sets over the remote api
    this.service.getCharacteristic(Characteristic.On)
      .on('get', (callback) => { this.get('power', callback); })
      .on('set', (value, callback) => {
        if (!this.disablePowerEvent) {
          this.setPower(value, callback);
        }
      });

    this.service.addCharacteristic(VolumeCharacteristic)
      .on('get', (callback) => { this.get('volume', callback); })
      .on('set', (value, callback) => { this.setBrightness(value, callback); });

    services.push(this.service);

    const service = new Service.AccessoryInformation();
    service.setCharacteristic(Characteristic.Manufacturer, 'GENERIC')
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial);
    services.push(service);

    return services;
  }
}

class AudioZone extends EventEmitter {
  constructor(log, config) {
    super();
    this.setMaxListeners(0);
    log('AudioZone Platform Created');
    this[priv] = {
      az: this,
      config,
      log,
      commandQueue: [],
      responderQueue: [],
      status: {},
    };
  }

  setVolume(id, level, cb) {
    cb();
  }

  getVolume(id, callback) {
    callback(50);
  }

  setPower(id, level, cb) {
    cb();
  }

  getPower(id, callback) {
    callback(false);
  }

  accessories(callback) {
    this[priv].log('Fetching Audio Zones.');
    const items = [];
    for (let i = 0; i < this[priv].config.lights.length; i++) {
      items.push(new AudioZoneItem(this.log, this[priv].config.lights[i], this));
    }
    callback(items);
  }
}

function Homebridge(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  makeVolumeCharacteristic();

  homebridge.registerAccessory('homebridge-audio-zone-item', 'AudioZoneItem', AudioZoneItem);
  homebridge.registerPlatform('homebridge-audio-zone', 'AudioZone', AudioZone);
}

Homebridge.accessory = AudioZoneItem;
Homebridge.platform = AudioZone;

module.exports = Homebridge;
