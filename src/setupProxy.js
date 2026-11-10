const express = require('express');
const matchReportHandler = require('../api/match-report');
const teamPreviewHandler = require('../api/team-preview');

module.exports = function setupProxy(app) {
    app.use('/api/match-report', express.json(), (req, res) => {
        return matchReportHandler(req, res);
    });

    app.use('/api/team-preview', express.json(), (req, res) => {
        return teamPreviewHandler(req, res);
    });
};
