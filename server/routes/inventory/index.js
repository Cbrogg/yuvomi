import express from 'express';
import locationsRouter from './locations.js';
import categoriesRouter from './categories.js';
import itemsRouter from './items.js';

const router = express.Router();
router.use('/locations', locationsRouter);
router.use('/categories', categoriesRouter);
router.use('/items', itemsRouter);

export default router;
