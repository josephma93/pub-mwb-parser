import express from 'express';
import logger from "./core/logger.mjs";
import {pinoHttp} from "pino-http";
import sourceHtmlRouter from './routes/source_html_router.mjs';
import scrappersRouter from './routes/scrappers_router.mjs';
import pubMwbRouter from './routes/pub_mwb_router.mjs';

const app = express();

app.use(pinoHttp({logger}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/source-html', sourceHtmlRouter);
app.use('/scrappers', scrappersRouter);
app.use('/', pubMwbRouter);
app.get('/ping', (req, res) => {
    return res.send('pong');
});

export default app;
