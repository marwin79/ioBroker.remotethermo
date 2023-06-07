"use strict";

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const tough = require("tough-cookie");
const { HttpsCookieAgent } = require("http-cookie-agent/http");

let baseURL;
let plantId;

class Remotethermo extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "remotethermo",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        await this.setStateAsync("info.connection", false, true);

        switch (this.config.service) {
            case "elco":
                baseURL = "https://www.remocon-net.remotethermo.com";
                break;
            case "ariston":
                baseURL = "https://www.ariston-net.remotethermo.com";
                break;
            default:
                this.log.info("No Service configured.");
                return;
        }

        plantId = this.config.plantId;

        this.log.debug(`Service URL: ${baseURL}`);

        this.createAllStates(plantId);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        // await this.setObjectNotExistsAsync("testVariable", {
        //     type: "state",
        //     common: {
        //         name: "testVariable",
        //         type: "boolean",
        //         role: "indicator",
        //         read: true,
        //         write: true,
        //     },
        //     native: {},
        // });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        // this.subscribeStates("testVariable");
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates("lights.*");
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates("*");

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync("testVariable", true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        // await this.setStateAsync("testVariable", { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        // await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync("admin", "iobroker");
        this.log.info("check user admin pw iobroker: " + result);

        result = await this.checkGroupAsync("admin", "admin");
        this.log.info("check group user admin group admin: " + result);


        this.userAgent = "ioBroker.remotethermo v0.0.1";
        this.cookieJar = new tough.CookieJar();
        this.requestClient = axios.create({
            jar: this.cookieJar,
            withCredentials: true,
            httpsAgent: new HttpsCookieAgent({ cookies: { jar: this.cookieJar } }),
        });

        this.updateInterval = null;

        // XXX
        // this.subscribeStates("*");

        let url = baseURL + "/R2/Account/Login";

        this.log.debug("Step 1: " + url);
        try {
            const response = await this.requestClient({
                method: "post",
                url: url,
                //headers:
                jar: this.cookieJar,
                withCredentials: true,
                data:
                {
                    Email: this.config.username,
                    Password: this.config.password
                }
            });
            this.log.debug(JSON.stringify(response.data));
            this.log.debug(JSON.stringify(response.status));
            this.log.debug(JSON.stringify(response.statusText));
            this.log.debug(JSON.stringify(response.headers));
            //this.log.debug(JSON.stringify(response.config));

            // {"ok":false,"redirectUrl":null,"message":"Field Email is invalid","debugMessage":""}
            // {"ok":true,"redirectUrl":null,"message":"","debugMessage":""}

            await this.setStateAsync("info.connection", true, true);

        } catch (error) {
            this.log.error("Login error.");

            if (typeof error === "string") {
                this.log.error(error);
            } else if (error instanceof Error) {
                this.log.error(error.message);
            }
            await this.setStateAsync("info.connection", false, true);
            return false;
        }
        this.log.debug("CookieJar:");
        this.log.debug(JSON.stringify(this.cookieJar));


        this.log.debug("Step 2");
        //this.poll();
        this.poll2();

        this.updateInterval = setInterval(async () => {

            //this.poll();

        }, 1 * 60 * 1000);

    }

    async poll2() {

        const data2 =
            JSON.stringify({
                useCache: true,
                zone: 1,
                filter: {
                    progIds: null,
                    plant: true,
                    zone: true
                }
            });
        try {
            // XXX Get plant ID(s) and use in object tree
            const response = await this.requestClient({
                method: "get",
                // https://www.remocon-net.remotethermo.com/R2/PlantMenuBsb/UserMenu/F0AD4E03EC5B
                //url: baseURL + "/R2/PlantMenuBsb/UserMenu/" + plantId + "?navMenuItem=BsbUserMenu",
                url: baseURL + "/R2/PlantMenuBsb/UserMenu/" + plantId,
                //headers: {
                //    "Content-Type": "application/json"
                //},
                jar: this.cookieJar,
                withCredentials: true,
                //data: data2
            });
            //this.log.debug(JSON.stringify(response.status));
            //this.log.debug(JSON.stringify(response.statusText));
            //this.log.debug(JSON.stringify(response.headers));
            //this.log.debug(JSON.stringify(response.config));
            //this.log.debug(JSON.stringify(response.data));

            const myArray = /nodes: (.*),\r\n/g.exec(response.data);
            //this.log.debug(myArray[1]);
            const myData = JSON.parse(myArray[1]);
            this.log.debug(JSON.stringify(myData[7]));
            //await this.setStateAsync("info.connection", true, true);

            //const plantData = response.data.data.plantData;
            //this.setStateAsync(`${plantId}.plant.outsideTemp`, plantData.outsideTemp, true);
            //this.setStateAsync(`${plantId}.plant.hasOutsideTempProbe`, plantData.hasOutsideTempProbe, true);
            //this.setStateAsync(`${plantId}.plant.dhwComfortTemp`, plantData.dhwComfortTemp.value, true);
            //this.setStateAsync(`${plantId}.plant.dhwReducedTemp`, plantData.dhwReducedTemp.value, true);
            //this.setStateAsync(`${plantId}.plant.dhwEnabled`, plantData.dhwEnabled, true);
            //this.setStateAsync(`${plantId}.plant.dhwMode`, plantData.dhwMode.value, true);
            //this.setStateAsync(`${plantId}.plant.flameSensor`, plantData.flameSensor, true);
            //this.setStateAsync(`${plantId}.plant.heatPumpOn`, plantData.heatPumpOn, true);
            //this.setStateAsync(`${plantId}.plant.dhwStorageTemp`, plantData.dhwStorageTemp, true);
            //this.setStateAsync(`${plantId}.plant.dhwStorageTempError`, plantData.dhwStorageTempError, true);
            //this.setStateAsync(`${plantId}.plant.hasDhwStorageProbe`, plantData.hasDhwStorageProbe, true);
            //this.setStateAsync(`${plantId}.plant.outsideTempError`, plantData.outsideTempError, true);
            //this.setStateAsync(`${plantId}.plant.isDhwProgReadOnly`, plantData.isDhwProgReadOnly, true);

            //const zoneData = response.data.data.zoneData;
            //this.setStateAsync(`${plantId}.zone.mode`, zoneData.mode.value, true);
            //this.setStateAsync(`${plantId}.zone.isHeatingActive`, zoneData.isHeatingActive, true);
            //this.setStateAsync(`${plantId}.zone.isCoolingActive`, zoneData.isCoolingActive, true);
            //this.setStateAsync(`${plantId}.zone.hasRoomSensor`, zoneData.hasRoomSensor, true);
            //this.setStateAsync(`${plantId}.zone.chComfortTemp`, zoneData.chComfortTemp.value, true);
            //this.setStateAsync(`${plantId}.zone.chReducedTemp`, zoneData.chReducedTemp.value, true);
            //this.setStateAsync(`${plantId}.zone.coolComfortTemp`, zoneData.coolComfortTemp.value, true);
            //this.setStateAsync(`${plantId}.zone.coolReducedTemp`, zoneData.coolReducedTemp.value, true);
            //this.setStateAsync(`${plantId}.zone.roomTemp`, zoneData.roomTemp, true);
            //this.setStateAsync(`${plantId}.zone.heatOrCoolRequest`, zoneData.heatOrCoolRequest, true);
            //this.setStateAsync(`${plantId}.zone.chProtectionTemp`, zoneData.chProtectionTemp, true);
            //this.setStateAsync(`${plantId}.zone.coolProtectionTemp`, zoneData.coolProtectionTemp, true);
            //this.setStateAsync(`${plantId}.zone.chHolidayTemp`, zoneData.chHolidayTemp, true);
            //this.setStateAsync(`${plantId}.zone.coolHolidayTemp`, zoneData.coolHolidayTemp, true);
            //this.setStateAsync(`${plantId}.zone.desiredRoomTemp`, zoneData.desiredRoomTemp, true);
            //this.setStateAsync(`${plantId}.zone.useReducedOperationModeOnHoliday`, zoneData.useReducedOperationModeOnHoliday, true);
            //this.setStateAsync(`${plantId}.zone.roomTempError`, zoneData.roomTempError, true);

            return true;

        } catch (error) {
            this.log.error("Login error.");

            if (typeof error === "string") {
                this.log.error(error);
            } else if (error instanceof Error) {
                this.log.error(error.message);
            }
            await this.setStateAsync("info.connection", false, true);
            return false;
        }
    }

    async poll() {

        const data2 =
            JSON.stringify({
                useCache: true,
                zone: 1,
                filter: {
                    progIds: null,
                    plant: true,
                    zone: true
                }
            });
        try {
            // XXX Get plant ID(s) and use in object tree
            const response = await this.requestClient({
                method: "post",
                url: baseURL + "/R2/PlantHomeBsb/GetData/" + plantId,
                headers: {
                    "Content-Type": "application/json"
                },
                jar: this.cookieJar,
                withCredentials: true,
                data: data2
            });
            this.log.debug(JSON.stringify(response.status));
            this.log.debug(JSON.stringify(response.statusText));
            this.log.debug(JSON.stringify(response.headers));
            //this.log.debug(JSON.stringify(response.config));
            this.log.debug(JSON.stringify(response.data.data));

            await this.setStateAsync("info.connection", true, true);

            const plantData = response.data.data.plantData;
            this.setStateAsync(`${plantId}.plant.outsideTemp`, plantData.outsideTemp, true);
            this.setStateAsync(`${plantId}.plant.hasOutsideTempProbe`, plantData.hasOutsideTempProbe, true);
            this.setStateAsync(`${plantId}.plant.dhwComfortTemp`, plantData.dhwComfortTemp.value, true);
            this.setStateAsync(`${plantId}.plant.dhwReducedTemp`, plantData.dhwReducedTemp.value, true);
            this.setStateAsync(`${plantId}.plant.dhwEnabled`, plantData.dhwEnabled, true);
            this.setStateAsync(`${plantId}.plant.dhwMode`, plantData.dhwMode.value, true);
            this.setStateAsync(`${plantId}.plant.flameSensor`, plantData.flameSensor, true);
            this.setStateAsync(`${plantId}.plant.heatPumpOn`, plantData.heatPumpOn, true);
            this.setStateAsync(`${plantId}.plant.dhwStorageTemp`, plantData.dhwStorageTemp, true);
            this.setStateAsync(`${plantId}.plant.dhwStorageTempError`, plantData.dhwStorageTempError, true);
            this.setStateAsync(`${plantId}.plant.hasDhwStorageProbe`, plantData.hasDhwStorageProbe, true);
            this.setStateAsync(`${plantId}.plant.outsideTempError`, plantData.outsideTempError, true);
            this.setStateAsync(`${plantId}.plant.isDhwProgReadOnly`, plantData.isDhwProgReadOnly, true);

            const zoneData = response.data.data.zoneData;
            this.setStateAsync(`${plantId}.zone.mode`, zoneData.mode.value, true);
            this.setStateAsync(`${plantId}.zone.isHeatingActive`, zoneData.isHeatingActive, true);
            this.setStateAsync(`${plantId}.zone.isCoolingActive`, zoneData.isCoolingActive, true);
            this.setStateAsync(`${plantId}.zone.hasRoomSensor`, zoneData.hasRoomSensor, true);
            this.setStateAsync(`${plantId}.zone.chComfortTemp`, zoneData.chComfortTemp.value, true);
            this.setStateAsync(`${plantId}.zone.chReducedTemp`, zoneData.chReducedTemp.value, true);
            this.setStateAsync(`${plantId}.zone.coolComfortTemp`, zoneData.coolComfortTemp.value, true);
            this.setStateAsync(`${plantId}.zone.coolReducedTemp`, zoneData.coolReducedTemp.value, true);
            this.setStateAsync(`${plantId}.zone.roomTemp`, zoneData.roomTemp, true);
            this.setStateAsync(`${plantId}.zone.heatOrCoolRequest`, zoneData.heatOrCoolRequest, true);
            this.setStateAsync(`${plantId}.zone.chProtectionTemp`, zoneData.chProtectionTemp, true);
            this.setStateAsync(`${plantId}.zone.coolProtectionTemp`, zoneData.coolProtectionTemp, true);
            this.setStateAsync(`${plantId}.zone.chHolidayTemp`, zoneData.chHolidayTemp, true);
            this.setStateAsync(`${plantId}.zone.coolHolidayTemp`, zoneData.coolHolidayTemp, true);
            this.setStateAsync(`${plantId}.zone.desiredRoomTemp`, zoneData.desiredRoomTemp, true);
            this.setStateAsync(`${plantId}.zone.useReducedOperationModeOnHoliday`, zoneData.useReducedOperationModeOnHoliday, true);
            this.setStateAsync(`${plantId}.zone.roomTempError`, zoneData.roomTempError, true);

            return true;

        } catch (error) {
            this.log.error("Login error.");

            if (typeof error === "string") {
                this.log.error(error);
            } else if (error instanceof Error) {
                this.log.error(error.message);
            }
            await this.setStateAsync("info.connection", false, true);
            return false;
        }
    }

    //    {
    //        timeProgs: [],
    //        plantData: {
    //          outsideTemp: 9.7,
    //          hasOutsideTempProbe: true,
    //          dhwComfortTemp: { min: 8, max: 47, value: 47, step: 1 },
    //          dhwReducedTemp: { min: 8, max: 47, value: 8, step: 1 },
    //          dhwEnabled: true,
    //          dhwMode: { value: 1, options: [Array] },
    //          flameSensor: false,
    //          heatPumpOn: false,
    //          dhwStorageTemp: 47.8,
    //          dhwStorageTempError: false,
    //          hasDhwStorageProbe: true,
    //          outsideTempError: false,
    //          isDhwProgReadOnly: false
    //        },
    //        zoneData: {
    //          holidays: [],
    //          mode: {
    //              allowedOptions: [ 0, 1, 2, 3 ],
    //              allowedOptionTexts: [ 'Protection', 'Automatic', 'Reduced', 'Comfort' ],
    //              value: 1
    //          },
    //          isHeatingActive: true,
    //          isCoolingActive: false,
    //          hasRoomSensor: false,
    //          chComfortTemp: { min: 16, max: 28, value: 19, step: 0.5 },
    //          chReducedTemp: { min: 10, max: 19, value: 16, step: 0.5 },
    //          coolComfortTemp: { min: 0, max: 0, value: 0, step: 0 },
    //          coolReducedTemp: { min: 0, max: 0, value: 0, step: 0 },
    //          roomTemp: 0,
    //          heatOrCoolRequest: true,
    //          chProtectionTemp: 10,
    //          coolProtectionTemp: 10,
    //          chHolidayTemp: 0,
    //          coolHolidayTemp: 0,
    //          desiredRoomTemp: 16,
    //          useReducedOperationModeOnHoliday: false,
    //          roomTempError: false
    //        }
    //      }

    // Plant
    async createAllStates(pId) {
        await this.setObjectNotExistsAsync(pId + ".plant.outsideTemp", {
            type: "state",
            common: {
                name: "Outside Temperature",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.hasOutsideTempProbe", {
            type: "state",
            common: {
                name: "Outside Temperature Probe",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.dhwComfortTemp", {
            type: "state",
            common: {
                name: "DHW Comfort Temperature",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.dhwReducedTemp", {
            type: "state",
            common: {
                name: "DHW Reduced Temperature",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.dhwEnabled", {
            type: "state",
            common: {
                name: "DHW Enabled",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.dhwMode", {
            type: "state",
            common: {
                name: "DHW Mode",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.flameSensor", {
            type: "state",
            common: {
                name: "Flame Sensor",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.heatPumpOn", {
            type: "state",
            common: {
                name: "Heatpump On",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.dhwStorageTemp", {
            type: "state",
            common: {
                name: "DHW Storage Temperature",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.dhwStorageTempError", {
            type: "state",
            common: {
                name: "DHW Temp(erature?) Error",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.hasDhwStorageProbe", {
            type: "state",
            common: {
                name: "DHW Storage Probe",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.outsideTempError", {
            type: "state",
            common: {
                name: "Outside Temp(erature?) Error",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".plant.isDhwProgReadOnly", {
            type: "state",
            common: {
                name: "DHW Prog ReadOnly",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });

        // Zone
        await this.setObjectNotExistsAsync(pId + ".zone.mode", {
            type: "state",
            common: {
                name: "mode",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.isHeatingActive", {
            type: "state",
            common: {
                name: "isHeatingActive",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.isCoolingActive", {
            type: "state",
            common: {
                name: "isCoolingActive",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.hasRoomSensor", {
            type: "state",
            common: {
                name: "hasRoomSensor",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.chComfortTemp", {
            type: "state",
            common: {
                name: "chComfortTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.chReducedTemp", {
            type: "state",
            common: {
                name: "chReducedTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.coolComfortTemp", {
            type: "state",
            common: {
                name: "coolComfortTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.coolReducedTemp", {
            type: "state",
            common: {
                name: "coolReducedTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.roomTemp", {
            type: "state",
            common: {
                name: "roomTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.heatOrCoolRequest", {
            type: "state",
            common: {
                name: "heatOrCoolRequest",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.chProtectionTemp", {
            type: "state",
            common: {
                name: "chProtectionTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.coolProtectionTemp", {
            type: "state",
            common: {
                name: "coolProtectionTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.chHolidayTemp", {
            type: "state",
            common: {
                name: "chHolidayTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.coolHolidayTemp", {
            type: "state",
            common: {
                name: "coolHolidayTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.desiredRoomTemp", {
            type: "state",
            common: {
                name: "desiredRoomTemp",
                type: "number",
                role: "value",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.useReducedOperationModeOnHoliday", {
            type: "state",
            common: {
                name: "useReducedOperationModeOnHoliday",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
        await this.setObjectNotExistsAsync(pId + ".zone.roomTempError", {
            type: "state",
            common: {
                name: "roomTempError",
                type: "boolean",
                role: "state",
                read: true,
                write: false,
            },
            native: {},
        });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            this.setState("info.connection", false, true);
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            this.updateInterval && clearInterval(this.updateInterval);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === "object" && obj.message) {
    //         if (obj.command === "send") {
    //             // e.g. send email or pushover or whatever
    //             this.log.info("send command");

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    //         }
    //     }
    // }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Remotethermo(options);
} else {
    // otherwise start the instance directly
    new Remotethermo();
}
