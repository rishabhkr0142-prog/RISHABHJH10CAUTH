export type SdkLang =
  | 'csharp'
  | 'cpp'
  | 'java'
  | 'python'
  | 'php'
  | 'vbnet'
  | 'javascript'
  | 'typescript'
  | 'rust'
  | 'go'
  | 'ruby'
  | 'perl'
  | 'lua'
  | 'curl';

export interface SdkCredentials {
  appName: string;
  ownerId: string;
  secret: string;
  version?: string;
}

export function getSdkFileName(lang: SdkLang): string {
  switch (lang) {
    case 'csharp':
      return 'Program.cs';
    case 'cpp':
      return 'main.cpp';
    case 'java':
      return 'Main.java';
    case 'python':
      return 'main.py';
    case 'php':
      return 'index.php';
    case 'vbnet':
      return 'Program.vb';
    case 'javascript':
      return 'index.js';
    case 'typescript':
      return 'auth.ts';
    case 'rust':
      return 'src/main.rs';
    case 'go':
      return 'main.go';
    case 'ruby':
      return 'main.rb';
    case 'perl':
      return 'main.pl';
    case 'lua':
      return 'main.lua';
    case 'curl':
      return 'curl.sh';
  }
}

export function getSdkIntegrationCode(
  lang: SdkLang,
  creds: SdkCredentials | null | undefined
): string {
  const safeAppName = creds?.appName?.trim() || 'YourApp';
  const safeOwnerId = creds?.ownerId?.trim() || '';
  const safeSecret = creds?.secret?.trim() || '';
  const safeVersion = creds?.version?.trim() || '1.0';

  switch (lang) {
    case 'csharp':
      return `using System;
using System.Threading.Tasks;
using RishabhAuth;

namespace MyApp
{
    class Program
    {
        public static RishabhAuthClient Client = new RishabhAuthClient(
            appName: "${safeAppName}",
            ownerId: "${safeOwnerId}",
            secret: "${safeSecret}",
            version: "${safeVersion}"
        );

        static async Task Main(string[] args)
        {
            var result = await Client.AuthenticateUserAsync(
                "user@example.com",
                "user_password"
            );

            if (result.IsValid)
            {
                Console.WriteLine(
                    $"Authenticated successfully: {result.User.Email}"
                );
            }
        }
    }
}`;

    case 'cpp':
      return `#include <iostream>
#include <string>
#include "RishabhAuthClient.hpp"

int main() {
    RishabhAuthClient client(
        /* appName */ "${safeAppName}",
        /* ownerId */ "${safeOwnerId}",
        /* secret  */ "${safeSecret}",
        /* version */ "${safeVersion}"
    );

    auto result = client.authenticateUser("user@example.com", "user_password");
    if (result.isValid()) {
        std::cout << "Authenticated successfully: " << result.getUser().email << std::endl;
    } else {
        std::cerr << "Authentication failed: " << result.getError() << std::endl;
    }

    return 0;
}`;

    case 'java':
      return `package com.example.myapp;

import com.rishabh.auth.RishabhAuthClient;
import com.rishabh.auth.AuthResult;

public class Main {
    public static RishabhAuthClient client = new RishabhAuthClient(
        "${safeAppName}",
        "${safeOwnerId}",
        "${safeSecret}",
        "${safeVersion}"
    );

    public static void main(String[] args) {
        AuthResult result = client.authenticateUser("user@example.com", "user_password");
        if (result.isValid()) {
            System.out.println("Authenticated successfully: " + result.getUser().getEmail());
        } else {
            System.err.println("Authentication failed: " + result.getErrorMessage());
        }
    }
}`;

    case 'python':
      return `from rishabh_auth import RishabhAuthClient

client = RishabhAuthClient(
    appName="${safeAppName}",
    ownerId="${safeOwnerId}",
    secret="${safeSecret}",
    version="${safeVersion}"
)

result = client.authenticate_user(
    "user@example.com",
    "user_password"
)

if result.is_valid:
    print(f"Authenticated successfully: {result.user['email']}")
else:
    print(f"Authentication failed: {result.error}")`;

    case 'php':
      return `<?php
require_once __DIR__ . '/vendor/autoload.php';

use RishabhAuth\\RishabhAuthClient;

$client = new RishabhAuthClient([
    'appName' => '${safeAppName}',
    'ownerId' => '${safeOwnerId}',
    'secret'  => '${safeSecret}',
    'version' => '${safeVersion}'
]);

$response = $client->authenticateUser('user@example.com', 'user_password');

if ($response->isValid()) {
    echo "Authenticated successfully: " . $response->getUser()['email'] . PHP_EOL;
} else {
    echo "Authentication failed: " . $response->getError() . PHP_EOL;
}`;

    case 'vbnet':
      return `Imports System
Imports System.Threading.Tasks
Imports RishabhAuth

Module Program
    Public Client As New RishabhAuthClient(
        appName:="${safeAppName}",
        ownerId:="${safeOwnerId}",
        secret:="${safeSecret}",
        version:="${safeVersion}"
    )

    Sub Main(args As String())
        Dim task = MainAsync()
        task.Wait()
    End Sub

    Async Function MainAsync() As Task
        Dim result = Await Client.AuthenticateUserAsync("user@example.com", "user_password")
        If result.IsValid Then
            Console.WriteLine($"Authenticated successfully: {result.User.Email}")
        Else
            Console.WriteLine($"Authentication failed: {result.Error}")
        End If
    End Function
End Module`;

    case 'javascript':
      return `import { RishabhAuthClient } from 'rishabh-auth-sdk';

const client = new RishabhAuthClient({
  appName: '${safeAppName}',
  ownerId: '${safeOwnerId}',
  secret: '${safeSecret}',
  version: '${safeVersion}'
});

async function run() {
  const result = await client.authenticateUser('user@example.com', 'user_password');
  if (result.isValid) {
    console.log('Authenticated successfully:', result.user.email);
  } else {
    console.error('Authentication failed:', result.error);
  }
}

run();`;

    case 'typescript':
      return `import { RishabhAuthClient, type AuthResponse } from 'rishabh-auth-sdk';

export const client = new RishabhAuthClient({
  appName: '${safeAppName}',
  ownerId: '${safeOwnerId}',
  secret: '${safeSecret}',
  version: '${safeVersion}'
});

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await client.authenticateUser(email, password);
  return response;
}`;

    case 'rust':
      return `use rishabh_auth::RishabhAuthClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = RishabhAuthClient::new(
        "${safeAppName}",
        "${safeOwnerId}",
        "${safeSecret}",
        "${safeVersion}"
    );

    let result = client.authenticate_user("user@example.com", "user_password").await?;
    if result.is_valid() {
        println!("Authenticated successfully: {}", result.user.email);
    } else {
        eprintln!("Authentication failed: {}", result.error.unwrap_or_default());
    }

    Ok(())
}`;

    case 'go':
      return `package main

import (
	"fmt"
	"log"

	"github.com/rishabh-jh10c/auth-go/rishabhauth"
)

func main() {
	client := rishabhauth.NewClient(
		"${safeAppName}",
		"${safeOwnerId}",
		"${safeSecret}",
		"${safeVersion}",
	)

	result, err := client.AuthenticateUser("user@example.com", "user_password")
	if err != nil || !result.Valid {
		log.Fatalf("Authentication failed: %v (%s)", err, result.Error)
	}

	fmt.Printf("Authenticated successfully: %s\\n", result.User.Email)
}
`;

    case 'ruby':
      return `require 'rishabh_auth'

client = RishabhAuth::RishabhAuthClient.new(
  appName: '${safeAppName}',
  ownerId: '${safeOwnerId}',
  secret: '${safeSecret}',
  version: '${safeVersion}'
)

result = client.authenticate_user(
  'user@example.com',
  'user_password'
)

if result.valid?
  puts "Authenticated successfully: #{result.user[:email]}"
else
  puts "Authentication failed: #{result.error}"
end`;

    case 'perl':
      return `use strict;
use warnings;
use RishabhAuth::Client;

my $client = RishabhAuth::Client->new(
    appName => '${safeAppName}',
    ownerId => '${safeOwnerId}',
    secret  => '${safeSecret}',
    version => '${safeVersion}'
);

my $result = $client->authenticate_user(
    'user@example.com',
    'user_password'
);

if ($result->{is_valid}) {
    print "Authenticated successfully: $result->{user}{email}\\n";
} else {
    print "Authentication failed: $result->{error}\\n";
}
`;

    case 'lua':
      return `local RishabhAuth = require("rishabh_auth")

local client = RishabhAuth.new({
    appName = "${safeAppName}",
    ownerId = "${safeOwnerId}",
    secret = "${safeSecret}",
    version = "${safeVersion}"
})

local result, err = client:authenticate_user("user@example.com", "user_password")

if result and result.isValid then
    print("Authenticated successfully: " .. result.user.email)
else
    print("Authentication failed: " .. (err or result.error or "Unknown error"))
end`;

    case 'curl':
      return `# Authenticate an Application End User
curl -X POST http://localhost:3000/api/auth/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "appName": "${safeAppName}",
    "ownerId": "${safeOwnerId}",
    "secret": "${safeSecret}",
    "action": "authenticate_user",
    "email": "user@example.com",
    "password": "user_password"
  }'

# Validate Application Credentials
curl -X POST http://localhost:3000/api/auth/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "appName": "${safeAppName}",
    "ownerId": "${safeOwnerId}",
    "secret": "${safeSecret}"
  }'`;
  }
}
