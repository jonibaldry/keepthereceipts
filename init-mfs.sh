#!/bin/sh
# Runs automatically before the daemon starts (kubo's /container-init.d hook).
# MFS (Mutable File System) isn't a separate service — it's part of the
# node's local repo, so we can seed a root folder here offline.
set -e

echo "Setting up MFS root directory..."
ipfs files mkdir -p /vault
ipfs files stat /vault

echo "Setting up document root directory..."
ipfs files mkdir -p /vault/document
ipfs files stat /vault/document
