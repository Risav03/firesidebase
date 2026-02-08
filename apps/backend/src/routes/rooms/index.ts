import { Elysia } from 'elysia';
import { roomManagementRoutes } from './room-management';
import { participantRoutes } from './participants';
import { integrationRoutes } from './integrations';
import { tippingRoutes } from './tipping';
import { summaryRoutes } from './summary';

/**
 * Main room routes aggregator
 * 
 * This file combines all room-related route modules:
 * - Room Management: CRUD operations for rooms
 * - Participants: Participant management and role handling
 * - Integrations: HMS API and external service interactions
 * - Tipping: Tip tracking and statistics
 * - Summary: Aggregated room statistics and summary
 */
export const roomRoutes = new Elysia({ prefix: '/rooms' })
  .use(roomManagementRoutes)
  .use(participantRoutes)
  .use(integrationRoutes)
  .use(tippingRoutes)
  .use(summaryRoutes);
