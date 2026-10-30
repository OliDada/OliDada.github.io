# (copy for olid.is: small fixes marked 'website' so it runs)
import sys

import pygame

from scripts.utils import load_image, load_images
from scripts.entities import PhysicsEntity
from scripts.tilemap import Tilemap

class Game:
    def __init__(self):
        pygame.init()

        pygame.display.set_caption('Mario')
        self.screen = pygame.display.set_mode((640, 480))
        self.display = pygame.Surface((320, 240))

        self.clock = pygame.time.Clock()
        
        self.movement = [False, False]
        
        self.assets = {
            'ground': [load_image('ground.png')] * 2,  # website: the tilemap asks for variant 1
            'block': [load_image('block.png')] * 2,
            'player': load_images('mario_img')[0]  # website: one picture, not the list
        }
        
        self.player = PhysicsEntity(self, 'player', (50, 50), (8, 15))
        
        self.tilemap = Tilemap(self, tile_size=16)
        
    def run(self):
        while True:
            self.display.fill((14, 219, 248))
            
            self.tilemap.render(self.display)
            
            self.player.update(self.tilemap, (self.movement[1] - self.movement[0], 0))
            self.player.render(self.display)
            
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_LEFT:
                        self.movement[0] = True
                    if event.key == pygame.K_RIGHT:
                        self.movement[1] = True
                    if event.key == pygame.K_UP:
                        self.player.velocity[1] = -3
                if event.type == pygame.KEYUP:
                    if event.key == pygame.K_LEFT:
                        self.movement[0] = False
                    if event.key == pygame.K_RIGHT:
                        self.movement[1] = False
            
            self.screen.blit(pygame.transform.scale(self.display, self.screen.get_size()), (0, 0))
            pygame.display.update()
            self.clock.tick(60)

Game().run()