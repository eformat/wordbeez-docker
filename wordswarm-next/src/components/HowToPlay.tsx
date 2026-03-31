'use client';

interface HowToPlayProps {
  onMainMenu: () => void;
}

export default function HowToPlay({ onMainMenu }: HowToPlayProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: 1024,
        height: 600,
        backgroundImage: 'url(/images/HowToPlay-background.png)',
      }}
    >
      {/* Bee */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 20,
          width: 106,
          height: 116,
          backgroundImage: 'url(/images/Bee-withBuzzingWings.png)',
          transform: 'rotate(45deg)',
        }}
      />

      <div style={{ paddingTop: 80, marginLeft: 100, font: '30px Oswald', color: '#ffc220' }}>
        Find words and add them to your hive, collect the honey and stay alive!
      </div>

      <div style={{ marginLeft: 100, font: '20px Oswald', color: '#ffffff' }}>
        WordSwarm is a fast-paced word game that challenges you to connect letters, in the cells of the honeycomb, to form words before the honey level runs out.
      </div>

      <ul style={{ listStyleImage: 'url(/images/BulletPoint-Hexagon.png)' }}>
        {[
          'When you start the game, the honey level begins to drop. Check out the list of words in your hive. Put your finger on one of the letters that begins a word in your list. Slide your finger across the screen as you select the connected, or adjacent, letters to complete that word.',
          'When the letters have been selected, those cells in the honeycomb darken. Release your finger when you have completed the word.',
          "If you have matched the right word, the letters for that word will disappear and you'll raise your honey level.",
          '"Bee" careful. Choosing letters for the wrong word will cause an X to appear.',
          'If you survive the time limit of the three rounds with honey still remaining, you advance to the next level!!',
          'You can turn sound effects and theme music on or off in the settings screens.',
        ].map((text, i) => (
          <li key={i} style={{ font: '18px Oswald', margin: '10px 15px 0px 80px', color: '#ffffff' }}>
            {text}
          </li>
        ))}
      </ul>

      {/* Main Menu button */}
      <div onClick={onMainMenu} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'absolute', bottom: 12, left: 400, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-leftcurve.png)' }} />
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            left: 445,
            width: 135,
            height: 40,
            backgroundImage: 'url(/images/SilverButton-centervertical.png)',
            backgroundRepeat: 'repeat-x',
            font: '14pt "Lato Black"',
            textAlign: 'center',
            lineHeight: '160%',
            color: '#393739',
            zIndex: 2,
          }}
        >
          MAIN MENU
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 580, width: 45, height: 60, backgroundImage: 'url(/images/SilverButton-rightcurve.png)' }} />
      </div>
    </div>
  );
}
