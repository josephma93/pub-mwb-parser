import * as cheerio from 'cheerio';
import { processExtractionInput } from "../../src/services/pub_mwb_scraper.mjs";

describe('processExtractionInput', () => {
  it('should throw an error if neither HTML nor Cheerio object is provided', () => {
    expect(() => processExtractionInput({})).toThrow();
  });

  it('should create a Cheerio object from HTML if not provided', () => {
    const html = '<html><body>Hello, world!</body></html>';
    const result = processExtractionInput({ html });
    expect(result.$).toBeDefined();
    expect(result.$('body').text()).toBe('Hello, world!');
  });

  it('should use the provided selection if available', () => {
    const html = '<html><h1>Hello</h1></html>';
    const $ = cheerio.load(html);
    const selection = $('h1');
    const result = processExtractionInput({ $, selection });
    expect(result.selection).toBe(selection);
  });

  it('should use the provided selection builder if available', () => {
    const html = '<html><h1>Hello</h1></html>';
    const $ = cheerio.load(html);
    const selectionBuilder = ($) => $('h1');
    const result = processExtractionInput({ $, selectionBuilder });
    expect(result.selection.html()).toBe(selectionBuilder($).html());
  });

  it('should return the processed input object', () => {
    const html = '<html><body><h1>Hello, world!</h1></body></html>';
    const selectionBuilder = ($) => $('h1');
    const result = processExtractionInput({ html, selectionBuilder });
    expect(result.$).toBeDefined();
    expect(result.$('h1').text()).toBe('Hello, world!');
    expect(result.html).toBe(html);
    expect(result.selection.html()).toBe(selectionBuilder(result.$).html());
  });
});