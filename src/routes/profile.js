const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { listAddressesByCustomerId, insertAddress, updateAddress, deleteAddress } = require('../db/addresses');
const { fetchProfileOverride, upsertProfileOverride } = require('../db/profileOverrides');

const PROFILES_PATH = path.join(__dirname, '..', 'db', 'profiles.json');

function loadProfiles() {
  return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
}

function errorMessage(error) {
  return error?.message || String(error);
}

router.get('/:personaId', async (req, res) => {
  try {
    const profiles = loadProfiles();
    const profile = profiles[req.params.personaId];
    if (!profile) {
      return res.status(404).json({ error: `No profile found for persona "${req.params.personaId}"` });
    }
    const [addresses, override] = await Promise.all([listAddressesByCustomerId(profile.customer_id), fetchProfileOverride(profile.customer_id).catch(() => null)]);
    const defaultAddress = addresses.find((a) => a.is_default) || addresses[0];
    res.json({
      data: {
        ...profile,
        name: override?.name ?? profile.name,
        email: override?.email ?? profile.email,
        phone: override?.phone ?? profile.phone,
        addresses,
        default_address_id: defaultAddress ? defaultAddress.id : profile.default_address_id
      }
    });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.patch('/:personaId', async (req, res) => {
  try {
    const customerId = resolveCustomerId(req, res);
    if (!customerId) return;
    const { name, email, phone } = req.body;
    const override = await upsertProfileOverride(customerId, { name, email, phone });
    res.json({ name: override.name, email: override.email, phone: override.phone });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

function resolveCustomerId(req, res) {
  const profiles = loadProfiles();
  const profile = profiles[req.params.personaId];
  if (!profile) {
    res.status(404).json({ error: `No profile found for persona "${req.params.personaId}"` });
    return null;
  }
  return profile.customer_id;
}

router.get('/:personaId/addresses', async (req, res) => {
  try {
    const customerId = resolveCustomerId(req, res);
    if (!customerId) return;
    res.json({ addresses: await listAddressesByCustomerId(customerId) });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

router.post('/:personaId/addresses', async (req, res) => {
  try {
    const customerId = resolveCustomerId(req, res);
    if (!customerId) return;
    const { label, line1, line2, city, state, postal_code, country, is_default } = req.body;
    const address = await insertAddress({ customerId, label, line1, line2, city, state, postalCode: postal_code, country, isDefault: is_default });
    res.json({ address });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.patch('/:personaId/addresses/:addressId', async (req, res) => {
  try {
    const customerId = resolveCustomerId(req, res);
    if (!customerId) return;
    const { label, line1, line2, city, state, postal_code, country, is_default } = req.body;
    const patch = {};
    if (label !== undefined) patch.label = label;
    if (line1 !== undefined) patch.line1 = line1;
    if (line2 !== undefined) patch.line2 = line2;
    if (city !== undefined) patch.city = city;
    if (state !== undefined) patch.state = state;
    if (postal_code !== undefined) patch.postal_code = postal_code;
    if (country !== undefined) patch.country = country;
    if (is_default !== undefined) patch.is_default = is_default;
    const address = await updateAddress(req.params.addressId, customerId, patch);
    if (!address) return res.status(404).json({ error: 'Address not found' });
    res.json({ address });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.delete('/:personaId/addresses/:addressId', async (req, res) => {
  try {
    const customerId = resolveCustomerId(req, res);
    if (!customerId) return;
    await deleteAddress(req.params.addressId, customerId);
    res.json({ status: 'DELETED' });
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

module.exports = router;
