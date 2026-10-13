# Guia de Estrutura de Mapas Customizados - Simulador de Baliza

Este documento detalha o formato de dados JSON aceito pelo **Simulador de Baliza** para a criação de fases e mapas customizados. Com esta especificação, você pode instruir qualquer outro Modelo de Linguagem (LLM) a projetar novos níveis criativos e perfeitamente compatíveis com o motor do jogo.

---

## 1. Sistema de Coordenadas e Dimensões

O jogo roda em um elemento `<canvas>` interativo bidimensional com as seguintes regras de espaço:

*   **Largura Total:** `800 px` (Eixo X de `0` a `800`)
*   **Altura Total:** `500 px` (Eixo Y de `0` a `500`)
*   **Origem `(0, 0)`:** Canto superior esquerdo da tela.
    *   *X cresce para a direita.*
    *   *Y cresce para baixo.*
*   **Ângulos (Headings / Rotações):** Definidos em **radianos**, onde:
    *   `0` radianos = Apontado totalmente para a **direita** (horizontal).
    *   `Math.PI / 2` (aprox. `1.5708`) = Apontado totalmente para **baixo** (vertical).
    *   `Math.PI` (aprox. `3.1416`) = Apontado totalmente para a **esquerda**.
    *   `-Math.PI / 2` ou `3 * Math.PI / 2` (aprox. `-1.5708`) = Apontado totalmente para **cima**.
    *   `Math.PI / 4` (aprox. `0.7854`) = Diagonal 45° para baixo e para a direita.

---

## 2. Dimensões de Referência (Escala Recomendada)

Para garantir que o carro de testes do jogador consiga navegar fisicamente pelo mapa sem ficar preso em áreas impossíveis, use as seguintes dimensões padronizadas:

| Elemento | Largura (`width`) | Altura (`height`) | Notas / Descrição |
| :--- | :--- | :--- | :--- |
| **Carro do Jogador** | `80` (X) | `40` (Y) | O veículo de teste tem sempre tamanho fixo de `80x40`. |
| **Carros Obstáculo** | `90` a `100` | `42` a `44` | Representam outros carros estacionados ou bloqueando caminhos. |
| **Vaga Comum (Paralela)** | `110` | `44` | Concede margem de folga aceitável nas laterais para manobra clássica. |
| **Vaga Apertada (Baliza)**| `95` a `100` | `42` | Exige manobras perfeitas com margem mínima de colisão. |
| **Pilares / Poste** | `15` | `15` | Obstáculos circulares ou quadrados compactos. |
| **Pedestres (NPCs)** | `16` | `16` | Círculos flutuantes com animação de passos. |
| **Guarnição / Paredes** | Ajustável | `10` a `20` | Esticados ao longo das bordas para simular calçadas ou limites do mapa. |

---

## 3. Especificação Completa do Objeto `Level`

Toda fase exportada/importada no jogo é descrita por um objeto JSON com os seguintes campos:

```typescript
interface Level {
  id: string;                      // Identificador único (ex: "custom_level_vagoes")
  phaseName: string;               // Nome de exibição na interface (ex: "Garagem Subterrânea")
  description: string;             // Texto de instrução/dicas inicial
  phaseIndex: number;              // Índice de progressão visual (use 1 a 6)
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'; // Clima luminoso/iluminação
  weather: 'clear' | 'rain';       // Clima (limpo ou chuva que gera pista escorregadia)
  timeLimit?: number;              // (Opcional) Tempo limite em segundos para concluir a baliza
  
  // Ponto de Partida do Jogador (Centro do carro)
  startX: number;                  // Posição X inicial (ex: 120)
  startY: number;                  // Posição Y inicial (ex: 280)
  startHeading: number;            // Direção inicial do veículo em radianos (ex: 0)

  // A Vaga de Estacionamento
  spot: ParkingSpot;

  // Obstáculos Físicos Colidíveis
  obstacles: Obstacle[];

  // Elementos Visuais Decorativos (Sem colisão, renderizados abaixo de tudo)
  decorations?: Decoration[];

  // Parâmetros de Física/Modo Avançado
  slope?: number;                  // Inclinação da ladeira em graus (-5 a 5). Faz o carro derivar por gravidade
  tightSqueezeMultiplier?: number; // Tolerância da vaga (0.5 a 1.0). Se < 1.0, reduz a área útil para pontuação perfeita
  patienceTime?: number;           // Tempo de paciência de carros traseiros antes de buzinarem (segundos)
}
```

### 3.1 O Objeto Vaga (`ParkingSpot`)

```typescript
interface ParkingSpot {
  x: number;               // Centro X da vaga
  y: number;               // Centro Y da vaga
  width: number;           // Largura da vaga
  height: number;          // Altura da vaga
  heading: number;         // Ângulo ideal de alinhamento em radianos (ex: 0 para paralelo, 1.57 para 90°)
  toleranceHeading: number; // Tolerância angular permitida para aprovação (em radianos, ex: 0.1 a 0.2)
  toleranceOffset: number;  // Desvio pixelar máximo permitido do centro da vaga (em pixels, ex: 10 a 15)
}
```

### 3.2 O Objeto Obstáculo (`Obstacle`)

Representa qualquer objeto colidível. O centro geométrico é definido pelas propriedades `x` e `y`.

```typescript
interface Obstacle {
  id: string;               // ID único no mapa (ex: "pilar_central_1")
  type: 'wall' | 'car' | 'pilar' | 'construction' | 'pedestrian' | 'sweeper'; 
  x: number;                // Centro X do obstáculo
  y: number;                // Centro Y do obstáculo
  width: number;            // Largura
  height: number;           // Altura
  heading: number;          // Direção de rotação em radianos
  color?: string;           // Cor customizada em formato Hexadecimal (ex: "#a855f7")

  // --- Propriedades de IA e Movimentação ---
  speed?: number;           // Velocidade do movimento em pixels por segundo (Recomendado: 30 a 60)
  waypoints?: Vec2[];       // Lista de pontos [{x, y}] que o pedestre ou vassoura percorrerá continuamente
  pedestrianName?: string;  // Nome do pedestre que aparece em diálogos flutuantes (ex: "Roberto")
  mood?: 'anxious' | 'ironic' | 'optimistic' | 'indifferent' | 'dramatic' | 'expert'; // Humor nos diálogos
}
```

### 3.3 O Objeto Decoração (`Decoration`)

Ideal para desenhar guias de rua, faixas de pedestre, vagas vagas, pintura asfáltica ou linhas delimitadoras sem colisão física.

```typescript
interface Decoration {
  id: string;               // ID único
  type: 'line' | 'dashed-line' | 'area'; // Estilo visual da decoração
  x: number;                // Centro X
  y: number;                // Centro Y
  width: number;            // Largura
  height: number;           // Altura
  heading: number;          // Rotação em radianos
  color: string;            // Cor hexadecimal (ex: "#ffffff" ou "#eab308" para amarelo)
  opacity?: number;         // Opacidade (0.0 transparente a 1.0 totalmente visível)
}
```

---

## 4. Modelos Prontos de Referência (JSON Templates)

Abaixo estão dois modelos completos que você pode copiar e fornecer a outra LLM como exemplos de aprendizado por poucos disparos (*few-shot*).

### Exemplo 1: Baliza de Rua Clássica em Dia Chuvoso (Baliza Paralela)

```json
{
  "id": "chuva_paralela_custom",
  "phaseName": "Desafio na Chuva Paulistana",
  "description": "Estacione sob tempestade. O asfalto molhado reduz severamente a tração do freio!",
  "phaseIndex": 3,
  "timeOfDay": "afternoon",
  "weather": "rain",
  "timeLimit": 60,
  "startX": 100,
  "startY": 260,
  "startHeading": 0,
  "spot": {
    "x": 480,
    "y": 100,
    "width": 110,
    "height": 44,
    "heading": 0,
    "toleranceHeading": 0.12,
    "toleranceOffset": 15
  },
  "obstacles": [
    {
      "id": "carro_frente",
      "type": "car",
      "x": 330,
      "y": 100,
      "width": 95,
      "height": 42,
      "heading": 0,
      "color": "#1e40af"
    },
    {
      "id": "carro_atras",
      "type": "car",
      "x": 630,
      "y": 100,
      "width": 95,
      "height": 42,
      "heading": 0,
      "color": "#991b1b"
    },
    {
      "id": "calcada_topo",
      "type": "wall",
      "x": 400,
      "y": 30,
      "width": 800,
      "height": 12,
      "heading": 0,
      "color": "#475569"
    },
    {
      "id": "pedestre_curioso",
      "type": "pedestrian",
      "x": 420,
      "y": 140,
      "width": 16,
      "height": 16,
      "heading": 0,
      "speed": 40,
      "pedestrianName": "Dona Maria",
      "mood": "anxious",
      "waypoints": [
        { "x": 420, "y": 220 },
        { "x": 300, "y": 220 },
        { "x": 300, "y": 140 }
      ]
    }
  ],
  "decorations": [
    {
      "id": "faixa_divisoria",
      "type": "dashed-line",
      "x": 400,
      "y": 250,
      "width": 800,
      "height": 4,
      "heading": 0,
      "color": "#eab308",
      "opacity": 0.8
    }
  ]
}
```

### Exemplo 2: Garagem de Subsolo Apertada com Ladeira Gravitacional e Pilares

```json
{
  "id": "subsolo_rampa_custom",
  "phaseName": "O Labirinto do Shopping",
  "description": "Manobre em declive físico moderado desviando das colunas de concreto estruturais.",
  "phaseIndex": 5,
  "timeOfDay": "night",
  "weather": "clear",
  "startX": 700,
  "startY": 400,
  "startHeading": 3.14159,
  "slope": 3,
  "spot": {
    "x": 150,
    "y": 200,
    "width": 50,
    "height": 100,
    "heading": 1.5708,
    "toleranceHeading": 0.15,
    "toleranceOffset": 12
  },
  "obstacles": [
    {
      "id": "pilar_esq_topo",
      "type": "pilar",
      "x": 260,
      "y": 120,
      "width": 24,
      "height": 24,
      "heading": 0,
      "color": "#cbd5e1"
    },
    {
      "id": "pilar_esq_baixo",
      "type": "pilar",
      "x": 260,
      "y": 320,
      "width": 24,
      "height": 24,
      "heading": 0,
      "color": "#cbd5e1"
    },
    {
      "id": "carro_vaga_vizinho",
      "type": "car",
      "x": 70,
      "y": 200,
      "width": 90,
      "height": 44,
      "heading": 1.5708,
      "color": "#047857"
    }
  ],
  "decorations": [
    {
      "id": "linha_vaga_1",
      "type": "line",
      "x": 110,
      "y": 200,
      "width": 2,
      "height": 100,
      "heading": 0,
      "color": "#ffffff",
      "opacity": 0.9
    },
    {
      "id": "linha_vaga_2",
      "type": "line",
      "x": 190,
      "y": 200,
      "width": 2,
      "height": 100,
      "heading": 0,
      "color": "#ffffff",
      "opacity": 0.9
    }
  ]
}
```

---

## 5. Instruções Recomendadas de Prompt para outras LLMs

Ao pedir para outra LLM gerar um mapa, copie e cole as seguintes diretrizes para garantir conformidade matemática absoluta:

```text
Atue como um Engenheiro e Designer de Fases Profissional para um jogo web de estacionamento 2D. 
Sua tarefa é projetar um nível totalmente novo no formato JSON compatível.

Regras Cruciais de Layout para você seguir:
1. O Canvas tem o tamanho estrito de 800x500. Não coloque elementos fora desse intervalo (por exemplo, X < 5 ou X > 795, Y < 5 ou Y > 495).
2. O ponto de início do jogador (startX, startY) e a vaga do spot não devem se sobrepor aos obstáculos físicos criados, senão o jogador iniciará em colisão. Deixe um vão/área livre de pelo menos 100 pixels no início do spawn.
3. Se você criar pedestres móveis (tipo "pedestrian"), configure "speed" entre 30 e 65 e coloque de 2 a 4 pontos no array "waypoints" para desenhar uma patrulha lógica.
4. Use rotações ("heading") sempre em radianos. Lembre-se: horizontal é 0, vertical é Math.PI/2 (1.5708), etc.
5. Retorne APENAS o objeto JSON puro dentro de uma caixa de código de markdown. Não dê introduções ou explicações fora do JSON.
```

Com este guia em mãos, você poderá estender indefinidamente o catálogo de desafios do simulador usando inteligência artificial!
