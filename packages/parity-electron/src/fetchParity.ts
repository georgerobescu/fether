// Copyright 2015-2018 Parity Technologies (UK) Ltd.
// This file is part of Parity.
//
// SPDX-License-Identifier: BSD-3-Clause

import { app, BrowserWindow } from 'electron';
import axios from 'axios';
import { file } from 'checksum';
import { download } from 'electron-dl';
import { chmod, rename, unlink } from 'fs';
import { promisify } from 'util';
import * as retry from 'async-retry';

import { defaultParityPath, getParityPath } from './getParityPath';
import logger from './utils/logger';

const checksum = promisify(file);
const fsChmod = promisify(chmod);
const fsRename = promisify(rename);
const fsUnlink = promisify(unlink);

const VANITY_URL = 'https://vanity-service.parity.io/parity-binaries';

const getArch = () => {
  switch (process.platform) {
    case 'darwin':
    case 'win32':
      return 'x86_64';
    default: {
      switch (process.arch) {
        case 'arm':
          return 'arm';
        case 'arm64':
          return 'aarch64';
        case 'x32':
          return 'i686';
        default:
          return 'x86_64';
      }
    }
  }
};

const getOs = () => {
  switch (process.platform) {
    case 'darwin':
      return 'darwin';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
};

/**
 * Remove parity binary or partial binary in the userData folder, if it exists.
 */
export const deleteParity = async () => {
  const parityPath = await defaultParityPath();

  // Remove parity binary
  try {
    await fsUnlink(parityPath);
  } catch (e) {}

  // Remove parity partial binary (download was still in progress)
  try {
    await fsUnlink(`${parityPath}.part`);
  } catch (e) {}
};

/**
 * Downloads Parity, saves it to Electron's `userData` folder, and returns the
 * path to the downloaded binary once finished.
 */
export const fetchParity = async (
  mainWindow: BrowserWindow,
  {
    onProgress = () => {},
    parityChannel = 'beta'
  }: { onProgress: (progress: number) => void; parityChannel: string }
) => {
  try {
    const parityPath: string = retry(
      async (_, attempt: number) => {
        if (attempt > 1) {
          logger()('@parity/electron:main')('Retrying.');
        }

        // Delete any old Parity if it exists, otherwise electron-dl will
        // download the new binary with a (1) at the end of the filename
        await deleteParity();

        // Fetch the metadata of the correct version of parity
        const metadataUrl = `${VANITY_URL}?version=${parityChannel}&os=${getOs()}&architecture=${getArch()}`;
        logger()('@parity/electron:main')(`Downloading from ${metadataUrl}.`);
        const { data } = await axios.get(metadataUrl);

        // Get the binary's url
        const {
          name,
          downloadUrl,
          checksum: expectedChecksum
        }: { name: string; downloadUrl: string; checksum: string } = data[0].files.find(
          ({ name }) => name === 'parity' || name === 'parity.exe'
        );

        // Start downloading.
        const downloadItem = await download(mainWindow, downloadUrl, {
          directory: app.getPath('userData'),
          filename: `${name}.part`,
          onProgress
        });
        const downloadPath: string = downloadItem.getSavePath();

        // Once downloaded, we check the sha256 checksum
        // Calculate the actual checksum
        const actualChecksum: string = await checksum(downloadPath, {
          algorithm: 'sha256'
        });
        // The 2 checksums should of course match
        if (expectedChecksum !== actualChecksum) {
          throw new Error(
            `Checksum mismatch, expecting ${expectedChecksum}, got ${actualChecksum}.`
          );
        }

        // Set a+x permissions on the downloaded binary
        await fsChmod(downloadPath, '755');

        // Binary is ready to be used: remove `.part` from filename
        await fsRename(downloadPath, await defaultParityPath());

        // Double-check that Parity exists now.
        return getParityPath();
      },
      {
        retries: 3
      }
    );

    return parityPath;
  } catch (err) {
    await deleteParity();
    throw err;
  }
};