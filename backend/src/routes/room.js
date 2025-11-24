const router = require('express').Router();
const { createRoom, getRoomByCode } = require('../controllers/roomController');

router.post('/create', createRoom);
router.get('/code/:roomCode', getRoomByCode);

module.exports = router;
