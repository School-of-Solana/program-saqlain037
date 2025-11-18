import rawIdl from "./tip_jar.json";
import type { Idl } from "@coral-xyz/anchor";

// Handle both ESM-wrapped and plain JSON
const unwrapped = ((rawIdl as any).default ?? rawIdl) as Idl;

export const IDL = unwrapped;

export type TipJar = {
  "address": "Gu7sMSSwiYm4JhKisQxAEA8EyJhiKfE2WRQuPFiUjinK",
  "metadata": {
    "name": "tipJar",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initVault",
      "docs": [
        "Create a PDA vault for the caller."
      ],
      "discriminator": [
        77,
        79,
        85,
        150,
        33,
        217,
        52,
        106
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  112,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "sendTip",
      "docs": [
        "Anyone can send a tip (SOL) into the vault PDA."
      ],
      "discriminator": [
        231,
        88,
        56,
        242,
        241,
        6,
        31,
        59
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  112,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "tipVault"
              }
            ]
          }
        },
        {
          "name": "tipper",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "Vault owner can withdraw SOL from their PDA."
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  112,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.owner",
                "account": "tipVault"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "tipVault",
      "discriminator": [
        142,
        77,
        243,
        158,
        142,
        87,
        253,
        9
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "You are not authorized to perform this action"
    },
    {
      "code": 6002,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in the vault"
    },
    {
      "code": 6003,
      "name": "mathOverflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "tipVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "totalTips",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
