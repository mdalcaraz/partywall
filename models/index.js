const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

const sequelize = new Sequelize(config.database, config.username, config.password, config);

const Event        = require('./Event')(sequelize, Sequelize.DataTypes);
const Photo        = require('./Photo')(sequelize, Sequelize.DataTypes);
const MusicRequest = require('./MusicRequest')(sequelize, Sequelize.DataTypes);

Event.hasMany(Photo,        { foreignKey: 'event_id', onDelete: 'CASCADE' });
Photo.belongsTo(Event,      { foreignKey: 'event_id' });

Event.hasMany(MusicRequest, { foreignKey: 'event_id', onDelete: 'CASCADE' });
MusicRequest.belongsTo(Event, { foreignKey: 'event_id' });

module.exports = { sequelize, Sequelize, Event, Photo, MusicRequest };
