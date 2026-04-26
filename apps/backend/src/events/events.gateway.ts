import { Logger, OnModuleDestroy } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import Redis from "ioredis";

const EVENTS_CHANNEL = "crawler-lab:events";

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(EventsGateway.name);
  @WebSocketServer() server!: Server;
  private subscriber!: Redis;

  async afterInit() {
    this.subscriber = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
    });
    await this.subscriber.subscribe(EVENTS_CHANNEL);
    this.subscriber.on("message", (channel, payload) => {
      if (channel !== EVENTS_CHANNEL) return;
      try {
        const event = JSON.parse(payload);
        this.server.emit("crawl:event", event);
      } catch {
        /* ignore malformed payload */
      }
    });
    this.logger.log(`gateway ready, subscribed to ${EVENTS_CHANNEL}`);
  }

  handleConnection(client: Socket) {
    this.logger.debug(`client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`client disconnected: ${client.id}`);
  }

  onModuleDestroy() {
    this.subscriber?.disconnect();
  }
}
