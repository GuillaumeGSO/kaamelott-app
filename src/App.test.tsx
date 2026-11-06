import { fireEvent, render, screen, within } from '@testing-library/react';
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
  youtubeVideoId: null,
  youtubeStartSeconds: null,
  ...overrides,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Minimal fake of the API, routed by method + path.
let routes: Record<string, (url: URL, init?: RequestInit) => Response>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

const allQuotes = (...quotes: Quote[]) => () => json(200, { quotes });

beforeEach(() => {
  // No shuffle: quotes are dealt in the order the API returns them.
  vi.spyOn(Math, 'random').mockReturnValue(0.9999);
  routes = {
    'GET /quotes/all': allQuotes(
      quote('q1'),
      quote('q2'),
      quote('q3'),
      quote('a1', { character: 'Arthur', text: 'Arthur parle' }),
      quote('a2', { character: 'Arthur', text: 'Arthur reparle' }),
    ),
    'GET /quotes/likes': () => json(200, { likes: {} }),
    'GET /favorites': url => json(200, { alias: url.searchParams.get('alias'), quoteIds: [] }),
  };
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost');
    const route = routes[`${init?.method ?? 'GET'} ${url.pathname}`];
    return route ? route(url, init) : json(500, { error: `no route for ${url.pathname}` });
  });
});

// The filters, pseudo and theme live in the preferences sheet.
const openPreferences = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Préférences' }));
  return screen.getByRole('dialog', { name: 'Préférences' });
};

const calls = (path: string) =>
  fetchSpy.mock.calls.filter(([input]: [RequestInfo | URL]) => String(input).startsWith(path)).length;

describe('App', () => {
  test('shows a first quote and the character list', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Citation q1')).toBeInTheDocument();
    expect(screen.getByText('Franck Pitiot')).toBeInTheDocument();
    expect(screen.getByText('Livre I · La Quête')).toBeInTheDocument();

    const sheet = await openPreferences(user);
    expect(await within(sheet).findByRole('radio', { name: 'Perceval, 3 citations' })).toBeInTheDocument();
    expect(within(sheet).getByRole('radio', { name: 'Tous les personnages' })).toBeChecked();
  });

  test('finds a character by a part of the name, accents ignored', async () => {
    const user = userEvent.setup();
    routes['GET /quotes/all'] = allQuotes(
      quote('a1', { character: 'Arthur' }),
      quote('a2', { character: 'Arthur' }),
      quote('l1', { character: 'Léodagan' }),
      quote('l2', { character: 'Léodagan' }),
      quote('l3', { character: 'Léodagan' }),
    );
    render(<App />);
    const sheet = await openPreferences(user);
    await within(sheet).findByRole('radio', { name: 'Arthur, 2 citations' });

    await user.type(within(sheet).getByRole('searchbox', { name: 'Chercher un personnage' }), 'leo');

    expect(within(sheet).getByRole('radio', { name: 'Léodagan, 3 citations' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('radio', { name: 'Arthur, 2 citations' })).not.toBeInTheDocument();
  });

  test('"Encore une !" deals the next quote without calling the API again', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Citation q1');
    const callsAfterLoad = fetchSpy.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Encore une !' }));

    expect(await screen.findByText('Citation q2')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.length).toBe(callsAfterLoad);
    expect(calls('/quotes/all')).toBe(1);
  });

  test('shows the like count of the quote', async () => {
    routes['GET /quotes/likes'] = () => json(200, { likes: { q1: 3 } });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Ajouter aux favoris' })).toHaveTextContent('3');
  });

  test('still shows quotes when the like counts cannot be loaded', async () => {
    routes['GET /quotes/likes'] = () => json(500, { error: 'boom' });
    render(<App />);

    expect(await screen.findByText('Citation q1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter aux favoris' })).toHaveTextContent('0');
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

    const sheet = await openPreferences(user);
    await user.type(within(sheet).getByLabelText('Pseudo'), 'merlin');
    await user.click(within(sheet).getByRole('button', { name: 'Voir les citations' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }));

    const like = await screen.findByRole('button', { name: 'Retirer des favoris' });
    expect(like).toHaveAttribute('aria-pressed', 'true');
    expect(like).toHaveTextContent('4');
    expect(localStorage.getItem('kaamelott.alias')).toBe('merlin');
  });

  test('loads the liked quotes once when a pseudo is remembered', async () => {
    const user = userEvent.setup();
    localStorage.setItem('kaamelott.alias', 'merlin');
    routes['GET /favorites'] = () => json(200, { alias: 'merlin', quoteIds: ['q1', 'q3'] });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Retirer des favoris' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Encore une !' }));
    expect(await screen.findByText('Citation q2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter aux favoris' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Encore une !' }));
    expect(await screen.findByText('Citation q3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirer des favoris' })).toBeInTheDocument();

    expect(calls('/favorites')).toBe(1);
  });

  test('unliking updates the heart and the count', async () => {
    const user = userEvent.setup();
    localStorage.setItem('kaamelott.alias', 'merlin');
    routes['GET /quotes/likes'] = () => json(200, { likes: { q1: 2 } });
    routes['GET /favorites'] = () => json(200, { alias: 'merlin', quoteIds: ['q1'] });
    routes['POST /favorites'] = (_url, init) => {
      expect(JSON.parse(init?.body as string)).toEqual({ quoteId: 'q1', alias: 'merlin', favorite: false });
      return json(200, { quoteId: 'q1', alias: 'merlin', likes: 1 });
    };
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Retirer des favoris' }));

    const like = await screen.findByRole('button', { name: 'Ajouter aux favoris' });
    expect(like).toHaveTextContent('1');
  });

  test('picking a character shows one of their quotes when the sheet closes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Citation q1');
    const sheet = await openPreferences(user);

    await user.click(await within(sheet).findByRole('radio', { name: 'Arthur, 2 citations' }));
    await user.click(within(sheet).getByRole('button', { name: 'Voir les citations' }));

    const card = await screen.findByRole('article');
    expect(await within(card).findByText('Arthur parle')).toBeInTheDocument();
    expect(screen.getByText('Arthur', { selector: '.app-subtitle' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('closing the sheet without changing the filters keeps the quote', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Citation q1');
    const sheet = await openPreferences(user);

    await user.click(within(sheet).getByRole('button', { name: 'Voir les citations' }));

    expect(screen.getByText('Citation q1')).toBeInTheDocument();
  });

  test('forces night or day and remembers the choice', async () => {
    const user = userEvent.setup();
    render(<App />);
    const sheet = await openPreferences(user);
    expect(within(sheet).getByRole('radio', { name: 'Auto' })).toBeChecked();

    await user.click(within(sheet).getByRole('radio', { name: 'Nuit' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('kaamelott.theme')).toBe('dark');

    await user.click(within(sheet).getByRole('radio', { name: 'Auto' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('kaamelott.theme')).toBeNull();
  });

  test("everyone's favorites are the quotes liked at least once", async () => {
    const user = userEvent.setup();
    routes['GET /quotes/likes'] = () => json(200, { likes: { q3: 2 } });
    render(<App />);
    await screen.findByText('Citation q1');

    const sheet = await openPreferences(user);
    await user.click(within(sheet).getByRole('switch', { name: 'Seulement les favoris de tout le monde' }));
    await user.click(within(sheet).getByRole('button', { name: 'Voir les citations' }));

    expect(await screen.findByText('Citation q3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter aux favoris' })).toHaveTextContent('2');
  });

  test('with a pseudo, favorites are its own likes, crossed with the character', async () => {
    const user = userEvent.setup();
    localStorage.setItem('kaamelott.alias', 'merlin');
    routes['GET /favorites'] = () => json(200, { alias: 'merlin', quoteIds: ['q2', 'a2'] });
    render(<App />);
    await screen.findByText('Citation q1');

    const sheet = await openPreferences(user);
    await user.click(within(sheet).getByRole('switch', { name: 'Seulement mes favoris' }));
    await user.click(within(sheet).getByRole('radio', { name: 'Arthur, 2 citations' }));
    await user.click(within(sheet).getByRole('button', { name: 'Voir les citations' }));

    expect(await screen.findByText('Arthur reparle')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Encore une !' }));
    expect(await screen.findByText('Arthur reparle')).toBeInTheDocument();
  });

  test('says nothing was found when favorites are empty', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Citation q1');

    const sheet = await openPreferences(user);
    await user.click(within(sheet).getByRole('switch', { name: 'Seulement les favoris de tout le monde' }));
    await user.click(within(sheet).getByRole('button', { name: 'Voir les citations' }));

    expect(await screen.findByText('Rien trouvé, désolé.')).toBeInTheDocument();
  });

  test('shows the official teaser or trailer for a film quote', async () => {
    routes['GET /quotes/all'] = allQuotes(
      quote('f1', { film: 'Kaamelott premier volet (2021)', season: null, episode: null }),
      quote('f2', { film: 'Kaamelott – Deuxième Volet (partie 1)', season: null, episode: null }),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Citation f1');

    expect(screen.getByText('Kaamelott premier volet (2021)')).toBeInTheDocument();
    const teaser = screen.getByRole('button', { name: 'Voir le teaser' });
    expect(teaser.querySelector('img')).toHaveAttribute('src', 'https://i.ytimg.com/vi/RtvMQ6lcLzg/mqdefault.jpg');

    await user.click(screen.getByRole('button', { name: 'Encore une !' }));
    await screen.findByText('Citation f2');
    const trailer = screen.getByRole('button', { name: 'Voir la bande-annonce' });
    expect(trailer.querySelector('img')).toHaveAttribute('src', 'https://i.ytimg.com/vi/zs7TXGSXQfE/mqdefault.jpg');
  });

  test('falls back to a plain button when the clip has no thumbnail', async () => {
    routes['GET /quotes/all'] = allQuotes(quote('q1', { youtubeVideoId: 'abc123', youtubeStartSeconds: 42 }));
    render(<App />);
    await screen.findByText('Citation q1');

    fireEvent.error(screen.getByRole('button', { name: "Voir l'extrait" }).querySelector('img')!);

    const button = screen.getByRole('button', { name: "Voir l'extrait" });
    expect(button.querySelector('img')).toBeNull();
  });

  test('credits Wikiquote and its license', async () => {
    render(<App />);

    expect(screen.getByRole('link', { name: 'Wikiquote' })).toHaveAttribute('href', 'https://fr.wikiquote.org/wiki/Kaamelott');
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
    );
  });

  test('shows an error when the API is unreachable, and retries on the next tap', async () => {
    const user = userEvent.setup();
    const working = routes['GET /quotes/all'];
    routes['GET /quotes/all'] = () => json(500, { error: 'boom' });
    render(<App />);

    expect(await screen.findByText('Impossible de joindre le serveur. Réessaie.')).toBeInTheDocument();

    routes['GET /quotes/all'] = working;
    await user.click(screen.getByRole('button', { name: 'Encore une !' }));
    expect(await screen.findByText('Citation q1')).toBeInTheDocument();
  });

  test('opens the YouTube clip at the quote timestamp only on demand', async () => {
    const user = userEvent.setup();
    routes['GET /quotes/all'] = allQuotes(quote('q1', { youtubeVideoId: 'abc123', youtubeStartSeconds: 42 }));
    render(<App />);
    await screen.findByText('Citation q1');

    expect(screen.queryByTitle('Extrait vidéo de la citation')).not.toBeInTheDocument();
    const thumbnail = screen.getByRole('button', { name: "Voir l'extrait" }).querySelector('img');
    expect(thumbnail).toHaveAttribute('src', 'https://i.ytimg.com/vi/abc123/mqdefault.jpg');
    await user.click(screen.getByRole('button', { name: "Voir l'extrait" }));

    const iframe = screen.getByTitle('Extrait vidéo de la citation');
    expect(iframe.getAttribute('src')).toContain('youtube-nocookie.com/embed/abc123?start=42');
  });
});
