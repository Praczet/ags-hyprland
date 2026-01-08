// ambient.d.ts
declare module "gi://AstalNetwork" {
  import { GObject } from "gi://GObject";

  export default class Network extends GObject {
    static get_default(): Network;

    // Add the properties you use here to get autocomplete
    readonly wifi: Wifi | null;
    readonly wired: Wired | null;
    readonly client: Client | null;
    readonly primary: "wifi" | "wired";

    get_devices(): Array<Device>;
  }

  export class Client extends GObject {
    get_devices(): Array<Device>;
  }

  export class Device extends GObject {
    readonly interface: string;
    readonly state: number; // 100 = Active
    readonly deviceType: number; // 1 = Wifi, 2 = Ethernet
    readonly activeConnection: ActiveConnection | null;
    readonly ip4_config: IP4Config | null;
  }

  export class ActiveConnection extends GObject {
    readonly id: string; // This is the name "Work"
    readonly type: string;
  }

  export class Wifi extends Device {
    readonly ssid: string;
    readonly strength: number;
    readonly iconName: string;
    readonly device: Device;
  }

  export class Wired extends Device {
    readonly speed: number;
    readonly iconName: string;
    readonly device: Device;
  }
  export class IPAddress {
    get_address(): string;
  }

  export class IP4Config {
    readonly gateway: string;
    get_addresses(): IPAddress[];
  }

}
