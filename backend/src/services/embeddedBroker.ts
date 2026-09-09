import { createServer, Server } from "net";

/**
 * Servidor MQTT Embebido para Residia (Aedes).
 * Proporciona conectividad MQTT local en el puerto 1883 sin requerir instalación
 * de software externo como Mosquitto en el entorno del desarrollador.
 */
const dynamicImport = new Function("specifier", "return import(specifier)");

class EmbeddedMqttBroker {
  private aedesInstance: any = null;
  private tcpServer: Server | null = null;
  private isRunning: boolean = false;

  public async start(port: number = 1883): Promise<boolean> {
    if (this.isRunning) return true;

    try {
      const aedesModule: any = await dynamicImport("aedes");
      const AedesClass = aedesModule.Aedes || aedesModule.default;

      if (!AedesClass || typeof AedesClass.createBroker !== "function") {
        return false;
      }

      this.aedesInstance = await AedesClass.createBroker();
      await this.aedesInstance.listen();

      return new Promise((resolve) => {
        this.tcpServer = createServer(this.aedesInstance.handle);

        this.tcpServer.once("error", (err: any) => {
          if (err.code === "EADDRINUSE") {
            console.log(`ℹ️  [MQTT Broker] Puerto ${port} en uso. Conectando a broker existente...`);
          } else {
            console.warn(`⚠️  [MQTT Broker Warning] No se pudo abrir puerto TCP ${port}: ${err.message}`);
          }
          resolve(false);
        });

        this.tcpServer.listen(port, "0.0.0.0", () => {
          this.isRunning = true;
          console.log(`\n==========================================================`);
          console.log(`🚀 [MQTT Broker Embebido] Broker local activo en puerto ${port}`);
          console.log(`   Canal MQTT listo para Gateways y Simulador de Caseta`);
          console.log(`==========================================================\n`);

          this.aedesInstance.on("client", (client: any) => {
            if (client && !client.id?.startsWith("residia_server_")) {
              console.log(`🔌 [MQTT Broker] Hardware/Simulador conectado: ID "${client.id}"`);
            }
          });

          this.aedesInstance.on("clientDisconnect", (client: any) => {
            if (client && !client.id?.startsWith("residia_server_")) {
              console.log(`🔌 [MQTT Broker] Hardware desconectado: ID "${client.id}"`);
            }
          });

          resolve(true);
        });
      });
    } catch (err: any) {
      console.warn(`⚠️  [MQTT Broker Warning] No se pudo iniciar broker embebido: ${err.message}`);
      return false;
    }
  }

  public async close() {
    if (this.tcpServer) {
      try {
        this.tcpServer.close();
      } catch {}
      this.tcpServer = null;
    }
    if (this.aedesInstance && this.isRunning) {
      try {
        await this.aedesInstance.close();
      } catch {}
      this.isRunning = false;
    }
  }
}

export const embeddedBroker = new EmbeddedMqttBroker();
