import { Elysia } from 'elysia';
import { roomManagementRoutes } from './room-management';
import { participantRoutes } from './participants';
import { chatRoutes } from './chat';
import { integrationRoutes } from './integrations';

/**
 * Main room routes aggregator
 * 
 * This file combines all room-related route modules:
 * - Room Management: CRUD operations for rooms
 * - Participants: Participant management and role handling
 * - Chat: Message handling and chat history
 * - Integrations: HMS API and external service interactions
 */
export const roomRoutes = new Elysia({ prefix: '/rooms' })
  .use(roomManagementRoutes)
  .use(participantRoutes)
  .use(chatRoutes)
  .use(integrationRoutes);
