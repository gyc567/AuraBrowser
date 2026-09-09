'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateIpHealthScore } = require('../../../Browserapp/automation/ip-health-score');

test('ip-health-score: empty input returns unknown level, null score', () => {
  const result = calculateIpHealthScore();
  assert.equal(result.score, null);
  assert.equal(result.level, 'unknown');
});

test('ip-health-score: residential IP gets review/70', () => {
  const result = calculateIpHealthScore({
    ip: '203.0.113.10',
    countryCode: 'US',
    asn: 'AS64500',
    proxy: false,
    hosting: false,
    mobile: false,
  });
  assert.equal(result.score, 70);
  assert.equal(result.level, 'review');
  assert.equal(result.confidence, 'low');
});

test('ip-health-score: high-risk IP gets risky/41', () => {
  const result = calculateIpHealthScore({
    ip: '2.27.132.142',
    countryCode: 'HK',
    asn: 'AS402279',
    asName: 'Geoscry Network LLC',
    hosting: false,
    proxy: false,
    mobile: false,
    riskIntel: {
      fraudScore: 59,
      isResidential: false,
      isBroadcast: false,
      asOrganization: 'Private Customer',
    },
  });
  assert.equal(result.score, 41);
  assert.equal(result.level, 'risky');
  assert.equal(result.label, '高风险');
  assert.equal(result.confidence, 'high');
  assert.equal(result.factors[0].code, 'risk-score');
});

test('ip-health-score: geo conflict surfaces as factor', () => {
  const result = calculateIpHealthScore({
    ip: '203.0.113.88',
    countryCode: 'HK',
    countryUsage: 'HK',
    countryRegistered: 'GB',
    countries: ['HK', 'GB'],
    geoConflict: true,
    countryNote: '多源地区不一致',
    asn: 'AS64510',
  });
  assert.equal(result.score, 58);
  assert.ok(result.factors.some((item) => item.code === 'geo-conflict'));
});

test('ip-health-score: proxy IP demoted to risky/35 with proxy factor', () => {
  const result = calculateIpHealthScore({
    ip: '198.51.100.20',
    countryCode: 'US',
    asn: 'AS64501',
    proxy: true,
    hosting: false,
  });
  assert.equal(result.score, 35);
  assert.equal(result.level, 'risky');
  assert.equal(result.factors[0].code, 'proxy');
});

test('ip-health-score: proxy + hosting combination gets proxy-hosting factor', () => {
  const result = calculateIpHealthScore({
    ip: '198.51.100.21',
    countryCode: 'US',
    asn: 'AS64502',
    proxy: true,
    hosting: true,
  });
  assert.equal(result.score, 25);
  assert.equal(result.factors[0].code, 'proxy-hosting');
});

test('ip-health-score: mobile IP gets review/67', () => {
  const result = calculateIpHealthScore({
    ip: '198.51.100.22',
    countryCode: 'US',
    asn: 'AS64503',
    mobile: true,
  });
  assert.equal(result.score, 67);
  assert.equal(result.level, 'review');
});

test('ip-health-score: result never leaks internal provider names (IPPure, ip-api, etc.)', () => {
  const cases = [
    calculateIpHealthScore(),
    calculateIpHealthScore({ ip: '1.2.3.4', countryCode: 'US' }),
    calculateIpHealthScore({
      ip: '2.27.132.142',
      countryCode: 'HK',
      riskIntel: { fraudScore: 99 },
    }),
  ];
  for (const result of cases) {
    const blob = JSON.stringify(result);
    assert.doesNotMatch(blob, /IPPure|ip-api|ipwho|ipinfo|不可用/i);
  }
});
