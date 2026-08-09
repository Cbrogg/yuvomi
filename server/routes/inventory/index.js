import express from 'express';
import locationsRouter from './locations.js';
import categoriesRouter from './categories.js';
import itemsRouter from './items.js';
import entriesRouter from './entries.js';

const router = express.Router();
router.use('/locations', locationsRouter);
router.use('/categories', categoriesRouter);
router.use('/items', itemsRouter);
router.use('/entries', entriesRouter);

export default router;
