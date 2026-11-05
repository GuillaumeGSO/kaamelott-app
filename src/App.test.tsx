import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App';
import type { Quote } from './api/client';

const quote = (quoteId: string, overrides: Partial<Quote> = {}): Quote => ({
  quoteId,
  character: 'Perceval',
  text: `Citation ${quoteId}`,
  actorName: 'Franck Pitiot',
  film: 'Kaamelott',
  season: 'Livre I',
  episode: 'La Quête',
  likes: 0,
  youtubeVideoId: null,
  youtubeStartSeconds: null,
  ...overrides,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Minimal fake of the API, routed by method + path.
let routes: Record<string, (url: URL, init?: RequestInit) => Response>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  routes = {
    'GET /characters': () =>
      json(200, [
        { character: 'Arthur', numberOfQuotes: 2 },
        { character: 'Perceval', numberOfQuotes: 3 },
      ]),
    'GET /quotes/random': () => json(200, { quotes: [quote('q1'), quote('q2'), quote('q3')] }),
  };
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    const route = routes[`${init?.method ?? 'GET'} ${url.pathname}`];
    return route ? route(url, init) : json(500, { error: `no route for ${url.pathname}` });
  });
});

const calls = (path: string) =>
  fetchSpy.mock.calls.filter(([input]: [RequestInfo | URL]) => String(input).startsWith(path)).length;

describe('App', () => {
  test('shows a first quote and the character list', async () => {
    render(<App />);

    expect(await screen.findByText('Citation q1')).toBeInTheDocument();
    expect(screen.getByText('Franck Pitiot')).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'Perceval (3)' })).toBeInTheDocument();
  });

  test('"Encore une !" serves the next queued quote without a new random fetch', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Citation q1');

    await user.click(screen.getByRole('button', { name: 'Encore une !' }));

    expect(await screen.findByText('Citation q2')).toBeInTheDocument();
    expect(calls('/quotes/random')).toBeGreaterThanOrEqual(1);
  });

  test('asks for a pseudo before liking', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Citation q1');

    await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Entre un pseudo pour liker.');
    expect(calls('/favorites')).toBe(0);
  });

  test('likes a quote with a pseudo and shows the new count', async () => {
    const user = userEvent.setup();
    routes['POST /favorites'] = (_url, init) => {
      expect(JSON.parse(init?.body as string)).toEqual({ quoteId: 'q1', alias: 'merlin', favorite: true });
      return json(200, { quoteId: 'q1', alias: 'merlin', likes: 4 });
    };
    render(<App />);
    await screen.findByText('Citation q1');

    await user.type(screen.getByLabelText('Pseudo'), 'merlin');
    await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }));

    const like = await screen.findByRole('button', { name: 'Retirer des favoris' });
    expect(like).toHaveAttribute('aria-pressed', 'true');
    expect(like).toHaveTextContent('4');
    expect(localStorage.getItem('kaamelott.alias')).toBe('merlin');
  });

  test('loads the liked state when a pseudo is remembered', async () => {
    localStorage.setItem('kaamelott.alias', 'merlin');
    routes['GET /favorites/status'] = url => json(200, { quoteId: url.searchParams.get('quoteId'), liked: true });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Retirer des favoris' })).toBeInTheDocument();
  });

  test('uses the character endpoint when a character is selected', async () => {
    const user = userEvent.setup();
    routes['GET /quotes/by-character/Arthur'] = () => json(200, quote('a1', { character: 'Arthur', text: 'Arthur parle' }));
    render(<App />);
    await screen.findByRole('option', { name: 'Arthur (2)' });

    await user.selectOptions(screen.getByLabelText('Personnage'), 'Arthur');
    await user.click(screen.getByRole('button', { name: 'Encore une !' }));

    const card = await screen.findByRole('article');
    expect(await within(card).findByText('Arthur parle')).toBeInTheDocument();
  });

  test('says nothing was found when favorites are empty', async () => {
    const user = userEvent.setup();
    routes['GET /quotes/by-favorites'] = () => json(404, { error: 'No favorites found' });
    render(<App />);
    await screen.findByText('Citation q1');

    await user.click(screen.getByLabelText('Seulement les favoris'));
    await user.click(screen.getByRole('button', { name: 'Encore une !' }));

    expect(await screen.findByText('Rien trouvé, désolé.')).toBeInTheDocument();
  });

  test('shows an error when the API is unreachable', async () => {
    routes['GET /quotes/random'] = () => json(500, { error: 'boom' });
    render(<App />);

    expect(await screen.findByText('Impossible de joindre le serveur. Réessaie.')).toBeInTheDocument();
  });

  test('opens the YouTube clip at the quote timestamp only on demand', async () => {
    const user = userEvent.setup();
    routes['GET /quotes/random'] = () =>
      json(200, { quotes: [quote('q1', { youtubeVideoId: 'abc123', youtubeStartSeconds: 42 })] });
    render(<App />);
    await screen.findByText('Citation q1');

    expect(screen.queryByTitle('Extrait vidéo de la citation')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "▶ Voir l'extrait" }));

    const iframe = screen.getByTitle('Extrait vidéo de la citation');
    expect(iframe.getAttribute('src')).toContain('youtube-nocookie.com/embed/abc123?start=42');
  });
});
