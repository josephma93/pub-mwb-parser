export default function checkHtmlContent(req, res, next) {
    const { html } = req.body;
    if (!html) {
        return res.status(400).json({ error: 'HTML content is required' });
    }
    next();
}