import { UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '@itzel/shared';
import { MessagesService } from './messages.service';

@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:4200', credentials: true } })
export class MessagesGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const user = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      client.data.user = user;
      client.join(`user:${user.sub}`);
      if (user.role === 'patient') {
        client.join(`patient:${user.sub}`);
      }
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('joinPatientConversation')
  joinPatient(@ConnectedSocket() client: Socket, @MessageBody() patientId: string) {
    const user = client.data.user as AuthUser;
    if (user.role === 'admin' || user.sub === patientId) {
      client.join(`patient:${patientId}`);
    }
  }

  @SubscribeMessage('sendMessage')
  async send(@ConnectedSocket() client: Socket, @MessageBody() payload: { patientId: string; content: string }) {
    const user = client.data.user as AuthUser;
    const message = await this.messagesService.send(payload, user);
    this.server.to(`patient:${payload.patientId}`).emit('messageCreated', message);
    return message;
  }
}
