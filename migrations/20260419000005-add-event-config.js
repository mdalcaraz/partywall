'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('events', 'location',        { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn('events', 'address',         { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.addColumn('events', 'photo_limit',     { type: Sequelize.INTEGER, defaultValue: 3,   allowNull: false });
    await queryInterface.addColumn('events', 'photo_window',    { type: Sequelize.INTEGER, defaultValue: 60,  allowNull: false });
    await queryInterface.addColumn('events', 'music_limit',     { type: Sequelize.INTEGER, defaultValue: 10,  allowNull: false });
    await queryInterface.addColumn('events', 'music_window',    { type: Sequelize.INTEGER, defaultValue: 600, allowNull: false });
    await queryInterface.addColumn('events', 'brand_name',      { type: Sequelize.STRING(120), defaultValue: 'Top DJ Group', allowNull: false });
    await queryInterface.addColumn('events', 'brand_logo_url',  { type: Sequelize.STRING(512), allowNull: true });
    await queryInterface.addColumn('events', 'brand_instagram', { type: Sequelize.STRING(100), defaultValue: 'topdjgroup', allowNull: false });
  },

  async down(queryInterface) {
    for (const col of ['location','address','photo_limit','photo_window','music_limit','music_window','brand_name','brand_logo_url','brand_instagram'])
      await queryInterface.removeColumn('events', col);
  },
};
