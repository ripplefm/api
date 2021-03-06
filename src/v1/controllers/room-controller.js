import { Router } from 'express';
import { BadRequestError } from '../errors';
import wrap from '../middleware/async-wrap';
import { authenticate } from '../middleware/authenticate';
import verifyPagination from '../middleware/verify-pagination';
import followers from './room-followers-controller';
import queue from './room-queue-controller';
import RoomService from '../services/room-service';
import QueueService from '../services/queue-service';
import HistoryService from '../services/history-service';

const roomRouter = Router();

roomRouter.param('id', (req, res, next, id) => {
  RoomService.findById(id)
    .then(room => {
      req.room = room;
      next();
    })
    .catch(err => next(err));
});

roomRouter.use('/:id/followers', followers);
roomRouter.use('/:id/queue', queue);

roomRouter.get(
  '/',
  verifyPagination(),
  wrap(async (req, res) => {
    const { page, limit, nextPageUrl } = req.query;
    const result = await RoomService.findAll(page, limit);
    const rooms = [];
    for (let room of result.rows) {
      rooms.push(
        Object.assign(room.toJSON(), {
          queueLength: await QueueService.getQueueLength(room),
          historyLength: await HistoryService.getHistoryLength(room)
        })
      );
    }
    const hasNext = page & (limit < result.count);
    res.json({
      pagination: {
        total: result.count,
        nextPageUrl: hasNext ? nextPageUrl : undefined
      },
      rooms
    });
  })
);

roomRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const room = req.room.toJSON();
    if (room.currentTrack) {
      room.currentTrack.currentTime = Date.now() - room.currentTrack.timestamp;
    }
    room.queue = await QueueService.getQueue(room);
    room.history = await HistoryService.getHistory(room);
    res.json(room);
  })
);

roomRouter.post(
  '/',
  authenticate,
  wrap(async (req, res) => {
    const { name, playType, accessType } = req.body;
    const room = await RoomService.createRoom(
      req.user,
      name,
      playType,
      accessType
    );
    res.status(201).json(await RoomService.findById(room.id));
  })
);

export default roomRouter;
