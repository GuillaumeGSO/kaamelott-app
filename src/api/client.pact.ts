// Pact contract between this site (consumer) and the kaamelott-lambda API (provider).
//
// Each interaction runs the real client function against Pact's mock server, which answers as
// described below. Passing tests write pacts/kaamelott-app-kaamelott-lambda.json: the contract,
// committed here and verified by kaamelott-lambda (`npm run pact:verify`) against the real
// handlers. Matchers (like, eachLike, integer) pin the shape of the responses, not the values.
//
// Run with `npm run pact:publish`, not `npm test`. Commit pacts/ whenever it changes: CI fails if
// the committed contract doesn't match this file.
import { MatchersV3, PactV4, type V3MockServer } from '@pact-foundation/pact';
import { describe, expect, test, vi } from 'vitest';
import { getAllQuotes, getFavorites, getLikes, postFavorite } from './client';

const { eachLike, integer, like, string } = MatchersV3;

const pact = new PactV4({ consumer: 'kaamelott-app', provider: 'kaamelott-lambda', dir: 'pacts' });

// The client calls relative URLs (same origin in the browser): send them to the mock server.
const realFetch = globalThis.fetch;
const useMockServer = (server: V3MockServer) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input, init) => realFetch(new URL(String(input), server.url), init));

describe('kaamelott-lambda API contract', () => {
  test('GET /quotes/all', () =>
    pact
      .addInteraction()
      .given('quotes exist')
      .uponReceiving('a request for every quote')
      .withRequest('GET', '/quotes/all')
      .willRespondWith(200, builder =>
        builder.jsonBody({
          quotes: eachLike({
            quoteId: string('q1'),
            character: string('Perceval'),
            text: string("C'est pas faux."),
          }),
        }),
      )
      .executeTest(async server => {
        useMockServer(server);
        const quotes = await getAllQuotes();
        expect(quotes[0]).toMatchObject({ quoteId: 'q1', character: 'Perceval' });
      }));

  test('GET /quotes/likes', () =>
    pact
      .addInteraction()
      .given('quote q1 has 2 likes')
      .uponReceiving('a request for the like counts')
      .withRequest('GET', '/quotes/likes')
      .willRespondWith(200, builder => builder.jsonBody({ likes: like({ q1: 2 }) }))
      .executeTest(async server => {
        useMockServer(server);
        expect(await getLikes()).toEqual({ q1: 2 });
      }));

  test('GET /favorites', () =>
    pact
      .addInteraction()
      .given('merlin has liked quote q1')
      .uponReceiving('a request for the quotes liked by a pseudo')
      .withRequest('GET', '/favorites', builder => builder.query({ alias: 'merlin' }))
      .willRespondWith(200, builder => builder.jsonBody({ quoteIds: eachLike('q1') }))
      .executeTest(async server => {
        useMockServer(server);
        expect(await getFavorites('merlin')).toEqual(['q1']);
      }));

  test('POST /favorites', () =>
    pact
      .addInteraction()
      .given('quote q1 exists')
      .uponReceiving('a like on a quote')
      .withRequest('POST', '/favorites', builder =>
        builder
          .headers({ 'Content-Type': 'application/json' })
          .jsonBody({ quoteId: 'q1', alias: 'merlin', favorite: true }),
      )
      .willRespondWith(200, builder => builder.jsonBody({ likes: integer(1) }))
      .executeTest(async server => {
        useMockServer(server);
        expect(await postFavorite('q1', 'merlin', true)).toBe(1);
      }));
});
