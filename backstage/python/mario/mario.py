# (copy for olid.is: image paths point at images/, and two small fixes marked 'website')
import pygame
from pygame.locals import *
import sys

pygame.init()

CLOCK = pygame.time.Clock()
FPS = 60
SCREEN_WIDTH = 1024
SCREEN_HEIGHT = 1024
SCREEN = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Mario")

scroll = [0, 0]

X_POSITION, Y_POSITION = 32 + 128, 32 + 760

TILE_SIZE = 64

BACKGROUND = pygame.transform.scale(pygame.image.load("images/background.png"), (SCREEN_WIDTH, SCREEN_HEIGHT))


def draw_grid():
    for line in range(0, 16):
        pygame.draw.line(SCREEN, (255, 255, 255), (0, line * TILE_SIZE), (SCREEN_WIDTH, line * TILE_SIZE))
        pygame.draw.line(SCREEN, (255, 255, 255), (line * TILE_SIZE, 0), (line * TILE_SIZE, SCREEN_HEIGHT))

class Player():
    def __init__(self, x, y):
        self.images_right = []
        self.images_left = []
        self.index = 0
        self.counter = 0
        for num in range(1, 5):
            img_right = pygame.image.load(f"images/mario_img/mario{num}.png")
            img_right = pygame.transform.scale(img_right, (64, 64))
            img_left = pygame.transform.flip(img_right, True, False)
            self.images_right.append(img_right)
            self.images_left.append(img_left)
        self.image = self.images_right[self.index]  
        
        self.img_jumping_right = pygame.transform.scale(pygame.image.load("images/mario_jumping.png"), (64, 64))
        self.img_jumping_left = pygame.transform.flip(self.img_jumping_right, True, False)

        self.rect = self.image.get_rect(center=(X_POSITION - scroll[0], Y_POSITION - scroll[1]))
        self.rect.x = x
        self.rect.y = y
        self.width = self.image.get_width()
        self.height = self.image.get_height()
        self.vel_y = 0
        self.jumped = False
        self.jumping = False
        self.direction = 0
        self.on_ground = False

    def update(self):
        dx = 0
        dy = 0
        walk_cooldown = 5  

        #keypresses
        key = pygame.key.get_pressed()
        if key[pygame.K_SPACE] and self.on_ground:
            self.vel_y = -17
            self.jumped = True
            self.jumping = True
        if key[pygame.K_SPACE] == False and self.on_ground:
            self.jumping = False
        
        if key[pygame.K_LEFT]:
            self.counter += 1
            self.direction = -1
            if self.rect.x > 0:
                dx -= 3
        # if key[pygame.K_a]:
        #     dx -= 5
        #     self.counter += 1
        #     self.direction = -1
        
        if key[pygame.K_RIGHT]:
            dx += 3
            self.counter += 1
            self.direction = 1
        # if key[pygame.K_d]:
        #     dx += 5
        #     self.counter += 1
        #     self.direction = 1
        
        if key[pygame.K_LEFT] == False and key[pygame.K_RIGHT] == False:
            self.counter = 0
            self.index = 0
            if self.direction == 1:
                self.image = self.images_right[self.index]
            if self.direction == -1:
                self.image = self.images_left[self.index]
        # if key[pygame.K_a] == False and key[pygame.K_d] == False:
        #     self.counter = 0
        #     self.index = 0
        #     if self.direction == 1:
        #         self.image = self.images_right[self.index]
        #     if self.direction == -1:
        #         self.image = self.images_left[self.index]       
        
        #animation for walking
        if not self.jumping and self.counter > walk_cooldown:
            self.counter = 0
            self.index += 1
            if self.index >= len(self.images_right):
                self.index = 0
            if self.direction == 1:
                self.image = self.images_right[self.index]
            elif self.direction == -1:
                self.image = self.images_left[self.index]            
    
        #gravity and jumping
        self.vel_y += 1
        if self.vel_y > 10:
            self.vel_y = 10
        dy += self.vel_y


        #check collision
        self.on_ground = False
        for tile in world.tile_list:
            # x direction check
            if tile[1].colliderect(self.rect.x + dx, self.rect.y, self.width, self.height):
                if dx > 0: #moving right
                    dx = tile[1].left - self.rect.right
                elif dx < 0: #moving left
                    dx = tile[1].right - self.rect.left

            # y direction check
            if tile[1].colliderect(self.rect.x, self.rect.y + dy, self.width, self.height):
                if self.vel_y < 0:
                    #check if jumping
                    dy = tile[1].bottom - self.rect.top
                    self.vel_y = 0
                    #check if falling
                elif self.vel_y >= 0:
                    dy = tile[1].top - self.rect.bottom
                    self.vel_y = 0
                    self.on_ground = True

                    
        #update position
        self.rect.x += dx
        self.rect.y += dy

        #draw correct image
        if self.jumping and self.direction == 1:
            SCREEN.blit(self.img_jumping_right, self.rect)
        elif self.jumping and self.direction == -1:
            SCREEN.blit(self.img_jumping_left, self.rect)
        else:
            SCREEN.blit(self.image, self.rect)

        #debuggin rectangle
        #pygame.draw.rect(SCREEN, (255, 255, 255), self.rect, 2)

class World():
    def __init__(self, data, offset=(0, 0)):
        self.tile_list = []

        ground_img = pygame.image.load('images/ground.png')
        block_img = pygame.image.load('images/block.png')
        
        row_count = 0
        for row in data:
            col_count = 0
            for tile in row:
                if tile == 'G':
                    img = pygame.transform.scale(ground_img, (TILE_SIZE, TILE_SIZE))
                    img_rect = img.get_rect()
                    img_rect.x = col_count * TILE_SIZE - offset[0]
                    img_rect.y = row_count * TILE_SIZE - offset[1]
                    tile = (img, img_rect)
                    self.tile_list.append(tile)
                elif tile == 'B':
                    img = pygame.transform.scale(block_img, (TILE_SIZE, TILE_SIZE))
                    img_rect = img.get_rect()
                    img_rect.x = col_count * TILE_SIZE - offset[0]
                    img_rect.y = row_count * TILE_SIZE - offset[1]
                    tile = (img, img_rect)
                    self.tile_list.append(tile)
                else:
                    pass
                col_count += 1
            row_count += 1

    def draw(self, offset=(0, 0)):
        for tile in self.tile_list:
            tile_rect = tile[1].copy()
            #tile_rect.x -= SCROLL[0]
            SCREEN.blit(tile[0],(tile_rect.x - offset[0], tile_rect.y - offset[1]))  # website: was offset(1)

            #rectangle for debgging
            #pygame.draw.rect(SCREEN, (255, 255, 255), tile[1], 2)

tile_map = [
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','.','.','B','B','B','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','.','B','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','.','.','B','B','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['.','.','.','.','.','B','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.','.'],
    ['G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G'],
    ['G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G'],
    ['G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G','G'],

]

player = Player(300, SCREEN_HEIGHT // 2)
world = World(tile_map)

#main game loop
while True:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()
    
    scroll[0] += 1
    SCREEN.blit(BACKGROUND, (0, 0))  # website: added the missing (0, 0)
    #draw_grid()
    world.draw()
    player.update()

    pygame.display.update()
    CLOCK.tick(FPS)